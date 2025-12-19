const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Upload file to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Name of the file
 * @param {string} bucket - Supabase bucket name (default: 'HND GATEWAY PDF')
 * @param {string} folder - Folder path (default: 'papers')
 * @returns {Promise<{url: string, path: string}>}
 */
const uploadFile = async (
  fileBuffer,
  fileName,
  bucket = "HND-GATEWAY-PDF",
  folder = "papers"
) => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY in environment variables."
    );
  }

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${fileName.replace(/\s+/g, "-")}`;
  const filePath = `${folder}/${uniqueFileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
};

/**
 * Delete file from Supabase Storage
 * @param {string} filePath - Path to file in storage
 * @param {string} bucket - Supabase bucket name
 * @returns {Promise<boolean>}
 */
const deleteFile = async (filePath, bucket = "HND-GATEWAY-PDF") => {
  if (!supabase) {
    console.warn("Supabase is not configured. Skipping file deletion.");
    return false;
  }

  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error(`Failed to delete file from Supabase: ${error.message}`);
    return false;
  }

  return true;
};

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
const isSupabaseConfigured = () => {
  return supabase !== null;
};

module.exports = {
  supabase,
  uploadFile,
  deleteFile,
  isSupabaseConfigured,
};
