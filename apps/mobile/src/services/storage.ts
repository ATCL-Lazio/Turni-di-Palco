import { supabase } from '../lib/supabase';
import { withMobileWatchdog } from './mobile-watchdog';

const PROFILE_UPLOAD_WATCHDOG_MS = 30000;

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  return withMobileWatchdog(async () => {
    if (!supabase) throw new Error('Supabase non configurato');

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/profile.${fileExt}`;

    const { error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
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
