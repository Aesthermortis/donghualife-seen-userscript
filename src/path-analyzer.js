/**
 * @module PathAnalyzer
 * @description Centralizes all path analysis logic for the DonghuaLife UserScript
 */
const PathAnalyzer = (() => {
  // Entity type constants
  const EntityType = {
    EPISODE: "episode",
    MOVIE: "movie",
    SERIES: "series",
    SEASON: "season",
    UNKNOWN: "unknown",
  };

  // Path patterns configuration
  const pathPatterns = {
    episode: [
      {
        pattern: /^\/episode\/([^/-]+(?:-[^/-]+)*)-(\d+)-episodio-([^/]+)$/i,
        type: "donghualife",
      },
      { pattern: /^\/episode\/(.+?)-(\d+)-(.+)$/i, type: "legacy" },
      { pattern: /^\/watch\//i, type: "generic" },
      { pattern: /^\/capitulo\//i, type: "generic" },
      { pattern: /^\/ver\//i, type: "generic" },
      { pattern: /^\/ep\//i, type: "generic" },
      { pattern: /^\/e\//i, type: "generic" },
    ],
    movie: [
      { pattern: /^\/movie\//i, type: "standard" },
      { pattern: /^\/pelicula\//i, type: "spanish" },
      { pattern: /^\/film\//i, type: "generic" },
      { pattern: /^\/movies\//i, type: "list" },
      { pattern: /^\/ver-pelicula\//i, type: "spanish" },
    ],
    series: [{ pattern: /^\/series\/([^/]+)$/i, type: "standard" }],
    season: [
      { pattern: /^\/season\/([^/-]+(?:-[^/-]+)*)-(\d+)$/i, type: "standard" },
      { pattern: /^\/season\/(.+)$/i, type: "simple" },
    ],
  };

  const excludedPaths = [/\/user\//i, /\/search\//i, /\/category\//i, /\/admin\//i, /\/api\//i];

  /**
   * Main analysis function that returns comprehensive path information
   * @param {string|URL|HTMLAnchorElement} input - Path to analyze (string, URL, or anchor element)
   * @returns {PathInfo} Complete path information
   */
  function analyze(input) {
    const pathname = extractPathname(input);

    if (!pathname) {
      return createErrorResult("Invalid input");
    }

    if (isExcluded(pathname)) {
      return createExcludedResult(pathname);
    }

    // Try to identify the entity type
    const entityInfo = identifyEntity(pathname);

    if (entityInfo.type === EntityType.UNKNOWN) {
      return createUnknownResult(pathname);
    }

    // Extract all related information
    const result = {
      pathname,
      type: entityInfo.type,
      id: pathname, // The pathname itself is the ID
      format: entityInfo.format,
      isValid: true,
      error: null,
    };

    // Add entity-specific information
    switch (entityInfo.type) {
      case EntityType.EPISODE:
        Object.assign(result, extractEpisodeInfo(pathname, entityInfo.format));
        break;
      case EntityType.SEASON:
        Object.assign(result, extractSeasonInfo(pathname, entityInfo.format));
        break;
      case EntityType.SERIES:
        Object.assign(result, extractSeriesInfo(pathname));
        break;
      case EntityType.MOVIE:
        Object.assign(result, extractMovieInfo(pathname, entityInfo.format));
        break;
    }

    // Add hierarchy information
    result.hierarchy = buildHierarchy(result);

    // Add metadata
    result.metadata = extractMetadata(result);

    return result;
  }

  /**
   * Extract pathname from various input types.
   *
   * Accepts a string (URL or pathname), a URL object, or an HTMLAnchorElement.
   * Returns the pathname portion of the input, or null if not extractable.
   *
   * @param {string|URL|HTMLAnchorElement} input - The input to extract the pathname from.
   * @returns {string|null} The extracted pathname, or null if extraction fails.
   */
  function extractPathname(input) {
    if (!input) {
      return null;
    }

    const tryCreateUrl = (value, base) => {
      try {
        return base ? new URL(value, base) : new URL(value);
      } catch {
        return null;
      }
    };

    const isHttpProtocol = (url) =>
      Boolean(url && (url.protocol === "http:" || url.protocol === "https:"));

    let cachedBaseHref = null;
    const getBaseHref = () => {
      if (cachedBaseHref) {
        return cachedBaseHref;
      }

      const candidates = [];

      if (typeof document !== "undefined" && typeof document.baseURI === "string") {
        candidates.push(document.baseURI);
      }

      if (typeof location !== "undefined" && typeof location.href === "string") {
        candidates.push(location.href);
      }

      for (const candidate of candidates) {
        if (!candidate || candidate === "about:blank") {
          continue;
        }
        const parsed = tryCreateUrl(candidate);
        if (isHttpProtocol(parsed)) {
          cachedBaseHref = parsed.href;
          return cachedBaseHref;
        }
      }

      cachedBaseHref = "http://localhost/";
      return cachedBaseHref;
    };

    if (typeof input === "string") {
      const value = input.trim();
      if (!value) {
        return null;
      }

      if (value.startsWith("/")) {
        const resolved = tryCreateUrl(value, getBaseHref());
        if (isHttpProtocol(resolved)) {
          return resolved.pathname;
        }
        const [pathname] = value.split(/[?#]/);
        return pathname || null;
      }

      const absolute = tryCreateUrl(value);
      if (isHttpProtocol(absolute)) {
        return absolute.pathname;
      }
      if (absolute) {
        return null;
      }

      const relative = tryCreateUrl(value, getBaseHref());
      return isHttpProtocol(relative) ? relative.pathname : null;
    }

    if (typeof URL !== "undefined" && input instanceof URL) {
      return isHttpProtocol(input) ? input.pathname : null;
    }

    if (input && input.nodeType === 1 && typeof input.href === "string") {
      const resolved = tryCreateUrl(input.href, getBaseHref());
      return isHttpProtocol(resolved) ? resolved.pathname : null;
    }

    return null;
  }

  /**
   * Determines whether the given pathname matches any of the excluded path patterns.
   *
   * Excluded paths are typically user, search, category, admin, or API routes
   * that should not be processed by the DonghuaLife UserScript.
   *
   * @param {string} pathname - The pathname to check against exclusion patterns.
   * @returns {boolean} True if the pathname is excluded, false otherwise.
   */
  function isExcluded(pathname) {
    return excludedPaths.some((pattern) => pattern.test(pathname));
  }

  /**
   * Identify the entity type and format from a given pathname.
   *
   * Iterates through all configured path patterns for episodes, movies, series, and seasons.
   * Returns an object containing the detected entity type and format, or UNKNOWN if no match.
   *
   * @param {string} pathname - The pathname to analyze.
   * @returns {{type: string, format: string|null}} Object with entity type and format.
   */
  function identifyEntity(pathname) {
    for (const [type, patterns] of Object.entries(pathPatterns)) {
      for (const { pattern, type: format } of patterns) {
        if (pattern.test(pathname)) {
          return { type, format };
        }
      }
    }
    return { type: EntityType.UNKNOWN, format: null };
  }

  /**
   * Extract episode-specific information from a pathname.
   *
   * Parses the pathname according to the detected format and returns
   * an object containing the episode number, series slug, season number,
   * and episode slug if available.
   *
   * @param {string} pathname - The pathname to extract episode info from.
   * @param {string} format - The format type detected for the episode path.
   * @returns {Object} An object with episodeNumber, seriesSlug, seasonNumber, and episodeSlug.
   */
  function extractEpisodeInfo(pathname, format) {
    const info = {
      episodeNumber: null,
      seriesSlug: null,
      seasonNumber: null,
      episodeSlug: null,
    };

    if (format === "donghualife") {
      const match = pathname.match(/^\/episode\/([^/-]+(?:-[^/-]+)*)-(\d+)-episodio-([^/]+)$/i);
      if (match) {
        info.seriesSlug = match[1];
        info.seasonNumber = parseInt(match[2], 10);
        info.episodeSlug = match[3];
      }
    } else if (format === "legacy") {
      const match = pathname.match(/^\/episode\/(.+?)-(\d+)-(.+)$/i);
      if (match) {
        info.seriesSlug = match[1];
        info.seasonNumber = parseInt(match[2], 10);
        info.episodeSlug = match[3];
      }
    }

    return info;
  }

  /**
   * Extract season-specific information from a pathname.
   *
   * Parses the pathname according to the detected format and returns
   * an object containing the series slug and season number if available.
   *
   * @param {string} pathname - The pathname to extract season info from.
   * @param {string} format - The format type detected for the season path.
   * @returns {Object} An object with seriesSlug and seasonNumber.
   */
  function extractSeasonInfo(pathname, format) {
    const info = {
      seriesSlug: null,
      seasonNumber: null,
    };

    if (format === "standard") {
      const match = pathname.match(/^\/season\/([^/-]+(?:-[^/-]+)*)-(\d+)$/i);
      if (match) {
        info.seriesSlug = match[1];
        info.seasonNumber = parseInt(match[2], 10);
      }
    } else if (format === "simple") {
      const match = pathname.match(/^\/season\/(.+)$/i);
      if (match) {
        const slug = match[1];
        const lastDashIndex = slug.lastIndexOf("-");
        if (lastDashIndex > 0) {
          const possibleNumber = slug.substring(lastDashIndex + 1);
          if (/^\d+$/.test(possibleNumber)) {
            info.seriesSlug = slug.substring(0, lastDashIndex);
            info.seasonNumber = parseInt(possibleNumber, 10);
          } else {
            info.seriesSlug = slug;
          }
        }
      }
    }

    return info;
  }

  /**
   * Extract series-specific information from a pathname.
   *
   * Parses the pathname to retrieve the series slug if present.
   *
   * @param {string} pathname - The pathname to extract series info from.
   * @returns {Object} An object containing the seriesSlug if found, otherwise null.
   */
  function extractSeriesInfo(pathname) {
    const info = {
      seriesSlug: null,
    };

    const match = pathname.match(/^\/series\/([^/]+)$/i);
    if (match) {
      info.seriesSlug = match[1];
    }

    return info;
  }

  /**
   * Extract movie-specific information from a pathname.
   *
   * Parses the pathname according to the detected format and returns
   * an object containing the movie slug and language.
   *
   * @param {string} pathname - The pathname to extract movie info from.
   * @param {string} format - The format type detected for the movie path.
   * @returns {Object} An object with movieSlug and language.
   */
  function extractMovieInfo(pathname, format) {
    const info = {
      movieSlug: null,
      language: format === "spanish" ? "es" : "en",
    };

    const match = pathname.match(/^\/(movie|pelicula|film|movies|ver-pelicula)\/([^/]+)$/i);
    if (match) {
      info.movieSlug = match[2];
    }

    return info;
  }

  /**
   * Build hierarchy information for the given entity.
   *
   * Constructs an object representing the hierarchical relationship of the entity,
   * including seriesId, seasonId, episodeId, and movieId as applicable.
   *
   * @param {Object} entityInfo - The analyzed entity information object.
   * @returns {Object} Hierarchy object containing parent and child IDs.
   */
  function buildHierarchy(entityInfo) {
    const hierarchy = {
      seriesId: null,
      seasonId: null,
      episodeId: null,
      movieId: null,
    };

    switch (entityInfo.type) {
      case EntityType.EPISODE:
        hierarchy.episodeId = entityInfo.id;
        if (entityInfo.seriesSlug && entityInfo.seasonNumber) {
          hierarchy.seasonId = `/season/${entityInfo.seriesSlug}-${entityInfo.seasonNumber}`;
          hierarchy.seriesId = `/series/${entityInfo.seriesSlug}`;
        }
        break;

      case EntityType.SEASON:
        hierarchy.seasonId = entityInfo.id;
        if (entityInfo.seriesSlug) {
          hierarchy.seriesId = `/series/${entityInfo.seriesSlug}`;
        }
        break;

      case EntityType.SERIES:
        hierarchy.seriesId = entityInfo.id;
        break;

      case EntityType.MOVIE:
        hierarchy.movieId = entityInfo.id;
        break;
    }

    return hierarchy;
  }

  /**
   * Extract metadata for the given entity information.
   *
   * Returns an object containing the slug, title (if available), and extraction timestamp.
   * Can be extended to extract additional metadata from the DOM if needed.
   *
   * @param {Object} entityInfo - The entity information object from analysis.
   * @returns {Object} Metadata object with slug, title, and extractedAt timestamp.
   */
  function extractMetadata(entityInfo) {
    return {
      slug: entityInfo.seriesSlug || entityInfo.movieSlug || null,
      title: null, // Could be populated from DOM if element is provided
      extractedAt: Date.now(),
    };
  }

  /**
   * Helper function to create an error result object for path analysis.
   *
   * Returns a standardized result object indicating an invalid path,
   * with error details and empty hierarchy/metadata.
   *
   * @param {string} error - Error message describing the failure.
   * @returns {Object} Error result object for path analysis.
   */
  function createErrorResult(error) {
    return {
      pathname: null,
      type: EntityType.UNKNOWN,
      id: null,
      isValid: false,
      error,
      hierarchy: {},
      metadata: {},
    };
  }

  /**
   * Helper function to create excluded result.
   *
   * Returns a standardized result object indicating that the path is excluded from analysis,
   * with error details, exclusion flag, and empty hierarchy/metadata.
   *
   * @param {string} pathname - The pathname that is excluded.
   * @returns {Object} Excluded result object for path analysis.
   */
  function createExcludedResult(pathname) {
    return {
      pathname,
      type: EntityType.UNKNOWN,
      id: null,
      isValid: false,
      error: "Path is excluded",
      isExcluded: true,
      hierarchy: {},
      metadata: {},
    };
  }

  /**
   * Helper function to create unknown result
   *
   * Returns a standardized result object indicating that the entity type could not be determined
   * for the given pathname. The result object contains the pathname, sets type to UNKNOWN,
   * marks isValid as false, and provides an error message. Hierarchy and metadata are empty.
   *
   * @param {string} pathname - The pathname for which the entity type is unknown.
   * @returns {Object} Unknown result object for path analysis.
   */
  function createUnknownResult(pathname) {
    return {
      pathname,
      type: EntityType.UNKNOWN,
      id: null,
      isValid: false,
      error: "Unknown entity type",
      hierarchy: {},
      metadata: {},
    };
  }

  /**
   * Batch analyze multiple paths
   * @param {Array} inputs - Array of paths to analyze
   * @returns {Array<PathInfo>} Array of results
   */
  function analyzeBatch(inputs) {
    return inputs.map((input) => analyze(input));
  }

  /**
   * Get parent path for a given path
   * @param {string} pathname - Path to analyze
   * @returns {string|null} Parent path or null
   */
  function getParent(pathname) {
    const result = analyze(pathname);

    if (!result.isValid) {
      return null;
    }

    switch (result.type) {
      case EntityType.EPISODE:
        return result.hierarchy.seasonId;
      case EntityType.SEASON:
        return result.hierarchy.seriesId;
      default:
        return null;
    }
  }

  /**
   * Get all parent paths in hierarchy
   * @param {string} pathname - Path to analyze
   * @returns {Array<string>} Array of parent paths from immediate to root
   */
  function getAncestors(pathname) {
    const result = analyze(pathname);
    const ancestors = [];

    if (!result.isValid) {
      return ancestors;
    }

    switch (result.type) {
      case EntityType.EPISODE:
        if (result.hierarchy.seasonId) {
          ancestors.push(result.hierarchy.seasonId);
        }
        if (result.hierarchy.seriesId) {
          ancestors.push(result.hierarchy.seriesId);
        }
        break;
      case EntityType.SEASON:
        if (result.hierarchy.seriesId) {
          ancestors.push(result.hierarchy.seriesId);
        }
        break;
    }

    return ancestors;
  }

  /**
   * Check if a path is of a specific type
   * @param {string} pathname - Path to check
   * @param {string} type - Type to check against
   * @returns {boolean}
   */
  function isType(pathname, type) {
    const result = analyze(pathname);
    return result.isValid && result.type === type;
  }

  /**
   * Get formatted display information
   * @param {string} pathname - Path to format
   * @returns {Object} Formatted information
   */
  function getDisplayInfo(pathname) {
    const result = analyze(pathname);

    if (!result.isValid) {
      return { title: "Unknown", subtitle: null };
    }

    switch (result.type) {
      case EntityType.EPISODE:
        return {
          title: `Episode ${result.episodeSlug || "Unknown"}`,
          subtitle: result.seasonNumber ? `Season ${result.seasonNumber}` : null,
          series: result.seriesSlug ? slugToTitle(result.seriesSlug) : null,
        };

      case EntityType.SEASON:
        return {
          title: result.seasonNumber ? `Season ${result.seasonNumber}` : "Season",
          subtitle: result.seriesSlug ? slugToTitle(result.seriesSlug) : null,
        };

      case EntityType.SERIES:
        return {
          title: result.seriesSlug ? slugToTitle(result.seriesSlug) : "Series",
          subtitle: "Series",
        };

      case EntityType.MOVIE:
        return {
          title: result.movieSlug ? slugToTitle(result.movieSlug) : "Movie",
          subtitle: "Movie",
        };

      default:
        return { title: "Unknown", subtitle: null };
    }
  }

  /**
   * Convert a slug string to title case for display purposes.
   *
   * Replaces hyphens and underscores with spaces, then capitalizes the first letter of each word.
   *
   * @param {string} slug - The slug string to convert (e.g., "donghua-life").
   * @returns {string} The converted title case string (e.g., "Donghua Life").
   */
  function slugToTitle(slug) {
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
  }

  /**
   * Converts a series ID or path to a human-readable series name.
   *
   * Analyzes the provided ID or path, verifies it is a valid series type,
   * and returns the formatted series name in title case. Returns null if
   * the input is not a valid series path or ID.
   *
   * @param {string} idOrPath - The series ID or pathname to format.
   * @returns {string|null} The formatted series name, or null if invalid.
   */
  function formatSeriesName(idOrPath) {
    const info = analyze(idOrPath);
    if (!info.isValid || info.type !== EntityType.SERIES) {
      return null;
    }
    return info.seriesSlug ? slugToTitle(info.seriesSlug) : null;
  }

  /**
   * Format a season name from a season path or ID.
   *
   * Analyzes the provided ID or path, verifies it is a valid season type,
   * and returns the formatted season name in the format "Series Name - SeasonNumber"
   * if both are available, or just the series name if the season number is missing.
   * Returns null if the input is not a valid season path or ID.
   *
   * @param {string} idOrPath - The season ID or pathname to format.
   * @returns {string|null} The formatted season name, or null if invalid.
   */
  function formatSeasonName(idOrPath) {
    const info = analyze(idOrPath);
    if (!info.isValid || info.type !== EntityType.SEASON) {
      return null;
    }
    const series = info.seriesSlug ? slugToTitle(info.seriesSlug) : null;
    if (series && Number.isInteger(info.seasonNumber)) {
      return `${series} - ${info.seasonNumber}`;
    }
    return series;
  }

  // Public API
  return {
    // Main functions
    analyze,
    analyzeBatch,
    formatSeriesName,
    formatSeasonName,

    // Helper functions
    getParent,
    getAncestors,
    isType,
    getDisplayInfo,

    // Type checkers
    isEpisode: (pathname) => isType(pathname, EntityType.EPISODE),
    isMovie: (pathname) => isType(pathname, EntityType.MOVIE),
    isSeries: (pathname) => isType(pathname, EntityType.SERIES),
    isSeason: (pathname) => isType(pathname, EntityType.SEASON),

    // Constants
    EntityType,

    // Utility
    extractPathname,
  };
})();
export default PathAnalyzer;
