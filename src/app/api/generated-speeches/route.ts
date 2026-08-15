import { NextRequest } from 'next/server';

import { IdentityError, resolveAppUser } from '@/lib/app-user';
import { deleteGeneratedSpeech, listGeneratedSpeeches } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';

/** Scripts written in Speech Practice, for the history tab's second view. */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await resolveAppUser(req, false);
    const speeches = await listGeneratedSpeeches(userId);
    return Response.json({ speeches });
  } catch (error) {
    if (error instanceof IdentityError) {
      // First visit before the guest cookie exists: nothing saved yet.
      return Response.json({ speeches: [] });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const body = await req.json().catch(() => null) as { speechId?: unknown } | null;
  const speechId = typeof body?.speechId === 'string' ? body.speechId.trim().slice(0, 128) : '';

  if (!speechId) {
    return Response.json({ ok: false, error: 'Missing speechId.' }, { status: 400 });
  }

  try {
    const { userId } = await resolveAppUser(req, false);
    const deleted = await deleteGeneratedSpeech(userId, speechId);

    if (!deleted) {
      return Response.json({ ok: false, error: 'Speech not found.' }, { status: 404 });
    }

    const speeches = await listGeneratedSpeeches(userId);
    return Response.json({ ok: true, speeches });
  } catch (error) {
    if (error instanceof IdentityError) {
      return Response.json({ ok: false, error: 'Session expired.' }, { status: 401 });
    }
    throw error;
  }
}

export const runtime = 'nodejs';
