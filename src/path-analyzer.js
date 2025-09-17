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
        Object.assign(result, extractSeriesInfo(pathname, entityInfo.format));
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
   * Extract pathname from various input types
   */
  function extractPathname(input) {
    if (!input) {
      return null;
    }

    // String input
    if (typeof input === "string") {
      try {
        // Check if it's already a pathname
        if (input.startsWith("/")) {
          return input;
        }
        // Try to parse as full URL
        const url = new URL(input);
        return url.pathname;
      } catch {
        return input.startsWith("/") ? input : null;
      }
    }

    // URL object
    if (input instanceof URL) {
      return input.pathname;
    }

    // HTMLAnchorElement
    if (input instanceof HTMLAnchorElement && input.href) {
      return new URL(input.href, window.location.origin).pathname;
    }

    // HTMLElement with href property
    if (input?.nodeType === 1 && typeof input.href === "string") {
      return new URL(input.href, window.location.origin).pathname;
    }

    return null;
  }

  /**
   * Check if path is excluded
   */
  function isExcluded(pathname) {
    return excludedPaths.some((pattern) => pattern.test(pathname));
  }

  /**
   * Identify entity type from pathname
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
   * Extract episode-specific information
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
   * Extract season-specific information
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
   * Extract series-specific information
   */
  function extractSeriesInfo(pathname, format) {
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
   * Extract movie-specific information
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
   * Build hierarchy information
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
   * Extract metadata (could be extended to extract from DOM if needed)
   */
  function extractMetadata(entityInfo) {
    return {
      slug: entityInfo.seriesSlug || entityInfo.movieSlug || null,
      title: null, // Could be populated from DOM if element is provided
      extractedAt: Date.now(),
    };
  }

  /**
   * Helper function to create error result
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
   * Helper function to create excluded result
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
   * Convert slug to title case
   */
  function slugToTitle(slug) {
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
  }

  /**
   * Format series name from ID or path
   * @param {string} idOrPath
   * @returns {string|null}
   */
  function formatSeriesName(idOrPath) {
    const info = analyze(idOrPath);
    if (!info.isValid || info.type !== EntityType.SERIES) {
      return null;
    }
    return info.seriesSlug ? slugToTitle(info.seriesSlug) : null;
  }

  /**
   * Format season name from ID or path
   * @param {string} idOrPath
   * @returns {string|null}
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
