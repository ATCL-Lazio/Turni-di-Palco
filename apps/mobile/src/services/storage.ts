import { supabase } from '../lib/supabase';

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
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
}
