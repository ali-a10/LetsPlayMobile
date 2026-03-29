import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';

export type UploadAvatarResult =
  | { success: true; publicUrl: string }
  | { success: false; error: string }
  | { success: false; cancelled: true };

/**
 * Opens the image picker, lets the user crop to a square, uploads the result
 * to Supabase Storage under the user's folder, and returns the public URL.
 */
export async function pickAndUploadAvatar(userId: string): Promise<UploadAvatarResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return { success: false, error: 'Photo library permission was denied.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled) return { success: false, cancelled: true };

  const response = await fetch(result.assets[0].uri);
  const arrayBuffer = await response.arrayBuffer();

  const filePath = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) return { success: false, error: uploadError.message };

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  // Append timestamp to bust React Native's URL cache when re-uploading
  return { success: true, publicUrl: `${data.publicUrl}?t=${Date.now()}` };
}
