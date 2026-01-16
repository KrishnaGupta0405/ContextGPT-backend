import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import ImageKit from "imagekit";
import sharp from "sharp";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary from a local path.
 */
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload the file on Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Remove the local file after successful upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    // Remove the local file in case of error
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return error;
  }
};

/**
 * Deletes a file from Cloudinary using its URL.
 */
const deleteFromCloudinary = async (fileUrl) => {
  try {
    if (!fileUrl) return null;

    // Extract full public ID by removing the Cloudinary base URL
    const urlParts = fileUrl.split("/");
    const fileNameWithVersion = urlParts.slice(-2).join("/"); // e.g., v1752738477/famz6l4bfrqwdo5h2chv.jpg
    const versionIndex = fileNameWithVersion.indexOf("/"); // position of slash
    const fileName = fileNameWithVersion.slice(versionIndex + 1); // remove version
    const publicId = fileName.replace(/\.[^/.]+$/, ""); // remove extension

    // Optional: include folder if you upload using one (e.g., avatars/)
    // const publicId = `avatars/${fileName.replace(/\.[^/.]+$/, "")}`;

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error.message);
    return null;
  }
};

// 🔁 If You Use a Folder
// If you upload files into a folder (e.g., "avatars/"), then you must prepend the folder name to the public_id, like this:

// ```java
// const publicId = `avatars/${fileName.replace(/\.[^/.]+$/, "")}`;
// ```

const imagekit = new ImageKit({
  publicKey: process.env.CONTEXTGPT_IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.CONTEXTGPT_IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.CONTEXTGPT_IMAGEKIT_URL_ENDPOINT,
});

const uploadOnImageKit = async (localFilePath, avatar = false) => {
  try {
    if (!localFilePath) return null;

    let fileBuffer = fs.readFileSync(localFilePath);

    if (avatar) {
      fileBuffer = await sharp(fileBuffer)
        .resize(300, 300)
        .toFormat("jpeg", { quality: 50 })
        .toBuffer();
    }

    const response = await imagekit.upload({
      file: fileBuffer,
      fileName: localFilePath.split(/[\\/]/).pop(),
      folder: "usersAvatar",
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

const deleteFromImageKit = async (fileId) => {
  try {
    if (!fileId) return null;
    return await imagekit.deleteFile(fileId);
  } catch (error) {
    console.error("Error deleting from ImageKit:", error.message);
    return null;
  }
};

export {
  uploadOnCloudinary,
  deleteFromCloudinary,
  uploadOnImageKit,
  deleteFromImageKit,
};

// Example cloudinary respose for the uploaded video
//{
//   asset_id: 'fb4b82c7d530bc1e23033e00a7afa614',
//   public_id: 'xix7gmk3q4nz2kz7e3kf',
//   version: 1752925647,
//   version_id: 'd1f6ca7a1a7e9ed4f3aa5197c8a20c48',
//   signature: '821d7cd6c591bc404bfcd3532a6a05b6ab7015b2',
//   width: 1080,
//   height: 1920,
//   format: 'mp4',
//   resource_type: 'video',
//   created_at: '2025-07-19T11:47:27Z',
//   tags: [],
//   pages: 0,
//   bytes: 2372976,
//   type: 'upload',
//   etag: 'aa0b007012d9fb956c8e267f1b12afbf',
//   placeholder: false,
//   url: 'http://res.cloudinary.com/de270gfyq/video/upload/v1752925647/xix7gmk3q4nz2kz7e3kf.mp4',
//   secure_url: 'https://res.cloudinary.com/de270gfyq/video/upload/v1752925647/xix7gmk3q4nz2kz7e3kf.mp4',
//   playback_url: 'https://res.cloudinary.com/de270gfyq/video/upload/sp_auto/v1752925647/xix7gmk3q4nz2kz7e3kf.m3u8',
//   asset_folder: '',
//   display_name: 'xix7gmk3q4nz2kz7e3kf',
//   audio: {
//     codec: 'aac',
//     bit_rate: '253375',
//     frequency: 48000,
//     channels: 2,
//     channel_layout: 'stereo'
//   },
//   video: {
//     pix_format: 'yuv420p',
//     codec: 'h264',
//     level: 40,
//     profile: 'High',
//     bit_rate: '5011771',
//     time_base: '1/30'
//   },
//   is_audio: false,
//   frame_rate: 30,
//   bit_rate: 5265966,
//   duration: 3.605,
//   rotation: 0,
//   original_filename: 'firstVideo',
//   nb_frames: 108,
//   api_key: '399516963375723'
// }
