import { ImageResponse } from 'next/og';

import { PREVIEW_IMAGE } from '@/lib/site';

export const alt = PREVIEW_IMAGE.alt;
export const size = { width: PREVIEW_IMAGE.width, height: PREVIEW_IMAGE.height };
export const contentType = PREVIEW_IMAGE.type;

/* The link preview for every page. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#06060b',
          color: '#f2efff',
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 4, color: '#a78bfa' }}>AAWAZ SPEAKER COACH</div>
        <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
          Practise your speech. Get an honest score.
        </div>
        <div style={{ fontSize: 32, color: '#a79dc8', marginTop: 28 }}>
          Structure · pace · pauses · filler words
        </div>
      </div>
    ),
    size,
  );
}
