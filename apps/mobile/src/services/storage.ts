import { supabase } from '../lib/supabase';
import { withMobileWatchdog } from './mobile-watchdog';

const PROFILE_UPLOAD_WATCHDOG_MS = 30000;
const ALLOWED_IMAGE_MIME_PREFIX = 'image/';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verify actual file content via magic bytes so that a caller cannot spoof the
// MIME type by setting file.type to 'image/jpeg' on a non-image payload (#1602).
async function hasImageMagicBytes(file: File): Promise<boolean> {
  if (file.size < 4) return false;
  const header = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(header);
  // JPEG: FF D8 FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;
  // GIF: GIF8
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;
  // WebP: RIFF at [0-3] and WEBP at [8-11]
  if (b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  return withMobileWatchdog(async () => {
    if (!supabase) throw new Error('Supabase non configurato');

    if (!UUID_PATTERN.test(userId)) {
      throw new Error('userId non valido: formato UUID atteso');
    }

    if (!file.type.startsWith(ALLOWED_IMAGE_MIME_PREFIX)) {
      throw new Error('Formato immagine non valido');
    }
    if (!await hasImageMagicBytes(file)) {
      throw new Error('Formato immagine non valido');
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      throw new Error('Immagine troppo grande (max 5MB)');
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = mimeToExt[file.type] ?? 'jpg';
    const fileName = `${userId}/profile.${ext}`;

    // Remove any pre-existing profile images with a different extension to
    // prevent orphan objects when the user switches upload format.
    const profileBucket = supabase.storage.from('profile-images');
    const otherExts = Object.values(mimeToExt).filter(e => e !== ext);
    await Promise.all(otherExts.map(e => profileBucket.remove([`${userId}/profile.${e}`])));

    const { error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      throw new Error('Impossibile ottenere l\'URL pubblico');
    }

    const separator = urlData.publicUrl.includes('?') ? '&' : '?';
    return `${urlData.publicUrl}${separator}v=${Date.now()}`;
  }, {
    operation: 'uploadProfileImage',
    timeoutMs: PROFILE_UPLOAD_WATCHDOG_MS,
    title: 'Upload immagine rallentato',
    message: 'Il caricamento dell immagine profilo sta impiegando troppo tempo.',
  });
}
