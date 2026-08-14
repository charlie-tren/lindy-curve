# The Lindy Effect - TODO

Deferred work for the Lindy Effect (charlietrenorden.com/lindy-effect/). The site is live.

## Extend beyond books (moved here from hub-notes 14/08/2026)

Lived in the hub TODO while this was still an idea; it belongs with the build now that
the books version has shipped.

- [ ] **Extend the Lindy screener beyond books - films, songs, other art forms**
      (asked 07/08/2026, after the books version was scoped). The same question asked of
      other media: what is still watched, still listened to, still looked at, and how does
      that decay with age. Do NOT start until the books version ships - it is the template.
      THE DATA IS THE WHOLE PROBLEM, and it is harder than books, because Gutenberg's
      `download_count` is a rare thing: a free, uniform, genuinely behavioural popularity
      signal with no licence attached. Probe before designing anything:
        - **Films.** TMDB has a free keyed API with `vote_count` and `popularity`, plus
          release dates - the closest analogue. Popularity is a rolling proprietary index
          rather than a count, so `vote_count` is the more honest axis. IMDb ratings are
          not licensed for redistribution; check TMDB's attribution terms before publishing.
        - **Songs.** The awkward one. Spotify play counts are not in the public API and
          chart data is heavily licensed. MusicBrainz plus **ListenBrainz** listen counts is
          the free, open, redistributable route, but its user base is small and skewed, so
          say so on the page. Last.fm scrobbles are an alternative with the same caveat.
        - **Art and architecture.** Wikimedia Commons file view counts, or Wikipedia
          pageviews via the free REST API. Pageviews are a decent cross-medium currency and
          would actually let a single chart hold books, films and songs on one axis - worth
          considering as the unifying signal rather than four incomparable ones.
      **The survivorship problem is much worse here.** Gutenberg at least holds obscure
      survivors; TMDB and streaming catalogues are curated, so the dead are missing even more
      completely. And recorded music only goes back ~120 years, so there is no deep-time
      axis at all - a Lindy curve over a century is a different and weaker claim.
      Sequencing thought: rather than four separate pages, the interesting version is ONE
      explorer with a medium toggle on a shared pageviews axis. That reuses the whole books
      build and makes the cross-medium comparison the actual product.
