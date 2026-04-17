import { supabase } from '../lib/supabase';
import { withMobileWatchdog } from './mobile-watchdog';

const PROFILE_UPLOAD_WATCHDOG_MS = 30000;
const ALLOWED_IMAGE_MIME_PREFIX = 'image/';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  return withMobileWatchdog(async () => {
    if (!supabase) throw new Error('Supabase non configurato');

    if (!file.type.startsWith(ALLOWED_IMAGE_MIME_PREFIX)) {
      throw new Error('Formato immagine non valido');
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      throw new Error('Immagine troppo grande (max 5MB)');
    }

    // Always use a fixed path so upsert truly overwrites the previous image
    // regardless of the source file extension, preventing orphan objects.
    const fileName = `${userId}/profile.jpg`;

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

    return urlData.publicUrl;
  }, {
    operation: 'uploadProfileImage',
    timeoutMs: PROFILE_UPLOAD_WATCHDOG_MS,
    title: 'Upload immagine rallentato',
    message: 'Il caricamento dell immagine profilo sta impiegando troppo tempo.',
  });
}
