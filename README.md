# The Lindy Effect

Every book on Project Gutenberg plotted by age against how much it is being read right
now. Live at **https://charlietrenorden.com/lindy-effect/**

The Lindy effect says that for things which do not perish, age is evidence of staying
power. Books are the cleanest available test, because Gutenberg publishes a download
count per text. This site measures it on 67,488 works and shows what comes out.

## The finding

**Age does not predict how much a surviving book is read.** Not a decay, not a rise.

The naive number says otherwise, which is the interesting part. Over the whole corpus
Spearman(age, downloads) is **+0.110** - older works read slightly more. But 61.5% of the
corpus sits in a narrow band between 300 and 600 downloads a month, far too uniform
across 41,500 mostly obscure works to be human readership, and Gutenberg does not
document what it is. Raise a threshold through that band and the correlation collapses
and changes sign:

| floor | works | Spearman |
|------:|------:|---------:|
| none | 67,488 | +0.110 |
| 600 | 15,968 | -0.025 |
| 1,000 | 6,705 | **-0.101** |
| 3,000 | 3,141 | -0.001 |
| 15,000 | 841 | +0.114 |

A relationship whose sign depends on where you draw an arbitrary line is not a
relationship. So the threshold is a **control on the page** rather than a decision buried
in the code - the visitor moves it and watches the finding fail.

## Why this cannot settle the Lindy question

Stated on the page, and worth repeating here: a catalogue of surviving texts contains no
failures. Gutenberg holds 947 works older than 500 years and every one is there because
somebody thought it worth digitising, while tens of thousands of forgotten recent works
sit alongside them. That is a selection decision, not the passage of time.

## Layout

```
tools/fetch.py      one request to Gutenberg's RDF feed -> data/corpus.csv
tools/analyse.py    the experiment, printed to stdout - run it and read it
tools/compute.py    corpus.csv -> data/derived.json (+ appends data/history.csv)
tools/build.py      derived.json + template.html -> docs/index.html
tools/template.html the page, with %%PLACEHOLDER%% substitutions
tests/smoke.py      Playwright checks against the built page
```

```bash
python tools/fetch.py && python tools/compute.py && python tools/build.py && python tests/smoke.py
```

## Things that bit, so they do not bite again

- **Do not use the gutendex API for the full corpus.** 32 books per page, no `page_size`,
  and deep pages take 12 to 20 seconds - 2,472 requests. The RDF tarball is one request
  and carries the same download numbers (verified equal on three books) plus author dates.
- **`pgterms:downloads` is the last 30 days, not cumulative.** Gutenberg's own docs: "the
  approximate number of downloads in the last 30 days (updated daily)". That is a feature
  - it removes any advantage from having been online longer - but it is seasonal, hence
  `data/history.csv`.
- **The curve's x-axis is AGE and rises to the right.** An earlier mock had the oldest
  works on the steep shoulder under a label reading "newer". `tests/smoke.py` asserts the
  oldest work's label sits past halfway, and the y-axis is labelled - the inversion went
  unnoticed the first time because there was nothing for the placement to contradict.
- **Never decimate a scatter with a threshold.** The first version kept everything above
  1,500 downloads and every 94th below, which drew a hard horizontal edge at exactly
  1,500 that reads as real structure. One uniform stride, always.
- **Dates are the author's, not the work's.** Gutenberg's `issued` is the upload date, so
  dates come from the author's lifespan capped at birth + 50. Forster wrote A Room with a
  View in 1908 and died in 1970; the cap turns a 62-year error into 21.
- **Titles carry entities and em dashes.** `&#13;` appears mid-title, and volume numbers
  are separated with an em dash. Both are normalised in `fetch.py`.
- **No `innerHTML` anywhere** - a security hook blocks it. Charts are built with
  `createElementNS` and text with `textContent`.
