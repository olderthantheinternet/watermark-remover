# Watermark Remover 🎬

A browser-based application for removing watermarks (like "pika" or "sora") from MP4 videos using AI-powered watermark removal via Segmind API.

## Features

- ✅ **AI-Powered**: Uses Segmind API for advanced watermark removal
- ✅ **Video Preview**: See your video before and after processing
- ✅ **Progress Tracking**: Real-time progress updates during processing
- ✅ **Modern UI**: Beautiful, responsive interface built with shadcn/ui
- ✅ **Easy Download**: Download your processed video with one click

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get a Segmind API Key**:
   - Sign up at [Segmind](https://www.segmind.com)
   - Navigate to [API Keys](https://docs.segmind.com/api-reference) in your dashboard
   - Generate your API key
   - Make sure you have credits in your account (pricing: $0.001 per GPU second)

3. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```bash
   VITE_SEGMIND_API_KEY=your_actual_api_key_here
   VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_name
   ```
   
   **Cloudinary Setup (Recommended for reliable uploads)**:
   - Sign up at [Cloudinary](https://cloudinary.com) (free tier available)
   - Get your Cloud Name from the dashboard
   - Create an Upload Preset:
     - Go to Settings → Upload → Upload presets
     - Click "Add upload preset"
     - Name it (e.g., "watermark")
     - **IMPORTANT**: Set Signing Mode to "Unsigned" (required for client-side uploads AND Segmind API access)
     - Set Resource Type to "Video"
     - Ensure "Allow unsigned uploads" is enabled
     - Save the preset
   - Add the Cloud Name and Preset name to your `.env` file
   
   **Note**: The upload preset MUST be "Unsigned" for Segmind API to access the uploaded videos. Signed URLs will cause "Internal Polling Error".
   
   **Note**: If Cloudinary is not configured, the app will fall back to free temporary hosting services (0x0.st, tmpfiles.org, file.io).

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Usage

1. Click to select an MP4 video file (max 100MB)
2. Preview your video
3. Click "Remove Watermark" to process
4. Wait for processing (may take a few minutes depending on video length)
5. Preview and download your watermark-free video

## API Configuration

This app uses **Segmind's Sora Watermark Remover API** for video processing.

### How It Works

1. **File Upload**: Your video is uploaded to a temporary file hosting service (0x0.st or file.io) to get a publicly accessible URL
2. **API Processing**: The video URL is sent to Segmind API for watermark removal
3. **Result**: The processed video URL is returned and displayed

### API Details

- **Endpoint**: `https://api.segmind.com/v1/video-watermark-remover`
- **Authentication**: API key via `x-api-key` header
- **Input**: Video URL (required)
- **Output**: Processed video URL

### Alternative Upload Methods

For production use, you may want to set up your own file upload solution instead of using temporary hosting services:

- **Backend Endpoint**: Create a simple backend that handles file uploads and returns URLs
- **Cloud Storage**: Use services like Cloudinary, AWS S3, or similar
- **Custom Solution**: Implement your own file hosting

See `src/components/WatermarkRemover.jsx` for the `uploadVideoToTempStorage` function if you want to customize the upload method.

## Technical Details

- **Framework**: React with Vite
- **UI**: shadcn/ui components with Tailwind CSS
- **API**: Segmind for AI-powered video watermark removal
- **File Size Limit**: 100MB (due to API and temporary storage constraints)
- **Temporary Storage**: Uses 0x0.st or file.io for temporary file hosting

## Limitations

- Maximum file size: 100MB
- Processing time depends on video length and API response time
- Requires Segmind API key and credits
- Internet connection required for API calls
- Temporary file hosting services may have their own limitations

## Error Handling

The app handles common API errors:
- **401**: Invalid API key
- **403**: Access forbidden
- **406**: Insufficient credits
- **429**: Rate limit exceeded

## Browser Compatibility

Works in modern browsers that support:
- File API
- Video playback
- Fetch API
- FormData

## Pricing

Segmind charges $0.001 per GPU second. Processing time varies based on video length and complexity. Check [Segmind Pricing](https://www.segmind.com/models/sora-wm-remover/pricing) for current rates.

## License

MIT
