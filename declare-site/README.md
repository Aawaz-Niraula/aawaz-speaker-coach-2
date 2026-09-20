# DECLARE campaign site

Single page. No framework, no build step.

## Run

    npm run dev        # serves on :8080
    # or
    python3 -m http.server 8080

Needs a server, not a double click, because the film and images are fetched.

## What is where

    index.html          the whole site, styles and script inline
    img/                9 school photos (WebP), logos, the campaign film
    frames/             kept from the earlier version, not used by index.html
    CONTENT.md          the copy on its own if you want to edit wording

## The hero

The logo is inline SVG, split into eight pieces: head, mouth, two eyes, two
ears, antenna and speech tail. Scrolling the first 400vh drives each piece:
stroked parts draw themselves with stroke-dashoffset, the eyes fade and fly in,
then the wordmark resolves from wide letterspacing. Nothing is a video, so it
stays sharp at any size and costs almost no bandwidth.

To retime a piece, edit the PARTS array in the script. Each entry has `a` and
`b`, the scroll fractions it animates between, plus `dx`, `dy` and `rot` for
where it flies in from.

The logo blue is #4EA9F0, taken from the original logo. Do not recolour it.

## Charts

Bar comparison and the donut are plain SVG and CSS, animated by an
IntersectionObserver when they scroll into view. No chart library.

## Colours

At the top of index.html under :root. Green is #00C853 on dark and #0A7A38 on
light, which is the contrast safe pair. Black is #080B09, off white #F1F4F2.

## Deploy

Static. Netlify or Vercel: drag the folder in. GitHub Pages: push and enable it.

## Copy rules

No em-dashes. No slogans. Always "we". Stats carry sources on the page.
