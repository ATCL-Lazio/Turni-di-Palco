import { describe, expect, it } from 'vitest';
import { sanitizeProfileImageUrl } from '../lib/profile-image-url';

const BASE = 'https://abcdefghijklmnopqrst.supabase.co';
const UID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER = '223e4567-e89b-12d3-a456-426614174000';
const good = `${BASE}/storage/v1/object/public/profile-images/${UID}/profile.jpg?v=1700000000000`;

describe('sanitizeProfileImageUrl', () => {
  it('accepts the url produced by uploadProfileImage', () => {
    expect(sanitizeProfileImageUrl(good, UID, BASE)).toBe(good);
    expect(sanitizeProfileImageUrl(good, undefined, BASE)).toBe(good);
    expect(sanitizeProfileImageUrl(good.split('?')[0], UID, BASE)).toBeDefined();
  });

  it('rejects another owner when an owner is given', () => {
    expect(sanitizeProfileImageUrl(good, OTHER, BASE)).toBeUndefined();
  });

  it('rejects foreign hosts, other buckets, schemes, extra params and junk', () => {
    for (const bad of [
      'https://evil.example/pixel.png',
      `https://abcdefghijklmnopqrst.supabase.co.evil.example/storage/v1/object/public/profile-images/${UID}/profile.jpg`,
      `${BASE}/storage/v1/object/public/other-bucket/${UID}/profile.jpg`,
      `${BASE}/storage/v1/object/public/profile-images/${UID}/../x/profile.jpg`,
      `${BASE}/storage/v1/object/public/profile-images/${UID}/profile.svg`,
      `${BASE}/storage/v1/object/public/profile-images/${UID}/profile.jpg?token=abc`,
      `http://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/profile-images/${UID}/profile.jpg`,
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      '',
      null,
      undefined,
    ]) {
      expect(sanitizeProfileImageUrl(bad, undefined, BASE)).toBeUndefined();
    }
  });

  it('rejects everything when the project url is not configured', () => {
    expect(sanitizeProfileImageUrl(good, UID, '')).toBeUndefined();
  });
});
