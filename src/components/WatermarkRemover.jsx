import React, { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Alert, AlertDescription } from './ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Loader2, File, Upload, AlertCircle, CheckCircle2, Info, Video, Download } from 'lucide-react'
import { cn } from '../lib/utils'

function WatermarkRemover() {
  const [file, setFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [processedVideoUrl, setProcessedVideoUrl] = useState(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file type
    if (!selectedFile.type.startsWith('video/') && !selectedFile.name.endsWith('.mp4')) {
      setError('Please select an MP4 video file.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file size (limit to 100MB for API processing)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (selectedFile.size > maxSize) {
      setError('File size too large. Maximum size is 100MB for processing.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setError('')
    setFile(selectedFile)
    setProcessedVideoUrl(null)
    
    // Create preview URL
    const url = URL.createObjectURL(selectedFile)
    setVideoPreviewUrl(url)
    setStatus('File selected. Ready to remove watermark.')
  }

  const handleFileAreaClick = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleChangeFile = (e) => {
    e.stopPropagation()
    if (fileInputRef.current && !isProcessing) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Helper function to upload video to temporary storage and get URL
  // Segmind API requires a video URL, not direct file upload
  const uploadVideoToTempStorage = async (videoFile) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    
    console.log('Cloudinary config check:', {
      cloudName: cloudName ? 'set' : 'not set',
      uploadPreset: uploadPreset ? 'set' : 'not set',
      fullEnv: import.meta.env
    })
    
    // Try Cloudinary first if credentials are configured
    if (cloudName && uploadPreset) {
      try {
        setStatus('Uploading to Cloudinary...')
        const formData = new FormData()
        formData.append('file', videoFile)
        formData.append('upload_preset', uploadPreset)
        formData.append('resource_type', 'video')
        
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/upload`
        const response = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('Cloudinary upload successful:', result)
          
          // Cloudinary returns secure_url (HTTPS) or url (HTTP)
          const videoUrl = result.secure_url || result.url
          if (videoUrl) {
            setStatus('Uploaded to Cloudinary successfully')
            console.log('Cloudinary video URL:', videoUrl)
            return videoUrl
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('Cloudinary upload failed:', errorData)
          throw new Error(errorData.error?.message || 'Cloudinary upload failed')
        }
      } catch (err) {
        console.warn('Cloudinary upload error:', err.message)
        // Fall through to backup services
      }
    }
    
    // Fallback to free services if Cloudinary is not configured or fails
    const formData = new FormData()
    formData.append('file', videoFile)
    
    // Create a timeout promise (30 seconds max)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
    )

    // Try multiple services with timeout
    // Order: 0x0.st first (most reliable for direct video access), then tmpfiles.org, then file.io
    const services = [
      {
        name: '0x0.st',
        url: 'https://0x0.st',
        handler: async () => {
          const response = await fetch('https://0x0.st', {
            method: 'POST',
            body: formData
          })
          if (response.ok) {
            const fileUrl = (await response.text()).trim()
            if (fileUrl.startsWith('http')) {
              console.log('0x0.st returned URL:', fileUrl)
              return fileUrl
            }
          }
          throw new Error('0x0.st upload failed')
        }
      },
      {
        name: 'tmpfiles.org',
        url: 'https://tmpfiles.org/api/v1/upload',
        handler: async () => {
          const response = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
          })
          if (response.ok) {
            const result = await response.json()
            console.log('tmpfiles.org full response:', result)
            
            if (result.status === 'success' && result.data?.url) {
              // tmpfiles.org returns URL in format: https://tmpfiles.org/dl/[id]/filename
              const downloadUrl = result.data.url
              console.log('tmpfiles.org download URL:', downloadUrl)
              return downloadUrl
            }
          }
          throw new Error('tmpfiles.org upload failed')
        }
      },
      {
        name: 'file.io',
        url: 'https://file.io',
        handler: async () => {
          const response = await fetch('https://file.io', {
            method: 'POST',
            body: formData
          })
          if (response.ok) {
            const result = await response.json()
            if (result.success && result.link) {
              return result.link
            }
          }
          throw new Error('file.io upload failed')
        }
      }
    ]

    // Try each service with timeout
    for (const service of services) {
      try {
        setStatus(`Uploading to ${service.name}...`)
        const fileUrl = await Promise.race([
          service.handler(),
          timeoutPromise
        ])
        setStatus(`Uploaded to ${service.name} successfully`)
        return fileUrl
      } catch (err) {
        console.warn(`${service.name} upload failed:`, err.message)
        continue
      }
    }

    // If all services fail, throw error with helpful message
    throw new Error(
      'Failed to upload video to temporary storage. ' +
      (cloudName && uploadPreset 
        ? 'Cloudinary upload failed and all fallback services failed. Please check your Cloudinary configuration.'
        : 'Please configure Cloudinary (VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET) for reliable uploads.')
    )
  }

  const handleRemoveWatermark = async () => {
    if (!file) {
      setError('Please select a video file first.')
      return
    }

    const apiKey = import.meta.env.VITE_SEGMIND_API_KEY
    if (!apiKey) {
      setError('Segmind API key not configured. Please set VITE_SEGMIND_API_KEY in your .env file.')
      return
    }

    setIsProcessing(true)
    setError('')
    setProgress(0)
    setStatus('Preparing video for processing...')
    setProcessedVideoUrl(null)

    try {
      // Step 1: Upload video to temporary storage to get a URL
      // Segmind API requires a video URL, not direct file upload
      setProgress(10)
      const videoUrl = await uploadVideoToTempStorage(file)
      
      setProgress(30)
      setStatus('Sending request to Segmind API...')

      // Step 2: Log the video URL for debugging
      setStatus('Preparing to send video to Segmind...')
      console.log('=== DEBUG INFO ===')
      console.log('Video URL to send to Segmind:', videoUrl)
      console.log('Video file name:', file.name)
      console.log('Video file size:', (file.size / (1024 * 1024)).toFixed(2), 'MB')
      console.log('Video file type:', file.type)
      console.log('==================')
      
      // Use the URL as-is from the upload service
      let finalUrl = videoUrl
      
      // For tmpfiles.org, we'll use the download URL format (with /dl/) as it's the official format
      // If somehow we got a direct URL, convert it to download format
      if (videoUrl.includes('tmpfiles.org') && !videoUrl.includes('/dl/')) {
        finalUrl = videoUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
        console.log('Converted tmpfiles.org URL to download format:', finalUrl)
      }
      
      setStatus('Sending request to Segmind API...')
      console.log('Final URL being sent:', finalUrl)
      
      // Step 3: Call Segmind API for watermark removal
      // Try v2 endpoint first (for longer processing), fallback to v1
      // According to Segmind docs: v1 completes in <60s, v2 for longer processing
      let response = null
      let endpointUsed = ''
      
      // Try v2 first (video processing may take longer)
      try {
        endpointUsed = 'https://api.segmind.com/v2/video-watermark-remover'
        console.log('Trying v2 endpoint (for longer processing):', endpointUsed)
        response = await fetch(endpointUsed, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: finalUrl,  // Parameter name is "input", not "input_video"
            base64: false
          })
        })
        
        if (!response.ok && response.status === 404) {
          // v2 doesn't exist, try v1
          console.log('v2 endpoint not found, trying v1')
          endpointUsed = 'https://api.segmind.com/v1/video-watermark-remover'
          response = await fetch(endpointUsed, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: finalUrl,  // Parameter name is "input", not "input_video"
              base64: false
            })
          })
        }
      } catch (err) {
        // If v2 fails, try v1
        console.log('v2 endpoint error, trying v1:', err.message)
        endpointUsed = 'https://api.segmind.com/v1/video-watermark-remover'
        response = await fetch(endpointUsed, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: finalUrl,  // Parameter name is "input", not "input_video"
            base64: false
          })
        })
      }
      
      if (!response) {
        throw new Error('Failed to get response from Segmind API')
      }
      
      console.log('Segmind API request sent. Endpoint used:', endpointUsed)
      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        let errorMessage = 'Failed to process video'
        
        console.error('=== SEGMIND API ERROR ===')
        console.error('Status:', response.status)
        console.error('Status Text:', response.statusText)
        console.error('Error Data:', errorData)
        console.error('Video URL that was sent:', finalUrl)
        console.error('========================')
        
        // Handle specific error codes
        if (response.status === 401) {
          errorMessage = 'Invalid API key. Please check your VITE_SEGMIND_API_KEY.'
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden. Check your API key permissions.'
        } else if (response.status === 406) {
          errorMessage = 'Insufficient credits. Please add credits to your Segmind account.'
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.'
        } else if (errorData.message || errorData.error) {
          errorMessage = errorData.message || errorData.error
          // If it's a video duration error with tmpfiles.org, try the direct URL format as fallback
          if ((errorMessage.includes('duration') || errorMessage.includes('Could not determine')) && finalUrl.includes('tmpfiles.org')) {
            // Try the direct URL format (without /dl/)
            const directUrlFormat = finalUrl.replace('/dl/', '/')
            console.log('Duration error detected. Trying direct URL format (without /dl/) as fallback:', directUrlFormat)
            
            // Try once more with the direct URL format
            try {
              setStatus('Retrying with direct URL format...')
              const retryResponse = await fetch('https://api.segmind.com/v1/video-watermark-remover', {
                method: 'POST',
                headers: {
                  'x-api-key': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  input: directUrlFormat,  // Parameter name is "input", not "input_video"
                  base64: false
                })
              })
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json()
                // Segmind API returns: { "output": "...", "status": "success" }
                if (retryResult.output || retryResult.video_url || retryResult.url) {
                  const processedUrl = retryResult.output || retryResult.video_url || retryResult.url
                  setProgress(100)
                  setStatus('Watermark removed successfully!')
                  setProcessedVideoUrl(processedUrl)
                  return // Success with fallback URL
                }
              } else {
                const retryError = await retryResponse.json().catch(() => ({}))
                console.error('Retry with direct URL format also failed:', retryError)
              }
            } catch (retryErr) {
              console.error('Retry with direct URL format also failed:', retryErr)
            }
            
            errorMessage += ' The video URL may not be accessible from Segmind\'s servers. This could be due to network restrictions or the temporary hosting service blocking API access. Try using 0x0.st or file.io instead, or set up your own file hosting.'
          }
        }
        
        throw new Error(errorMessage)
      }

      setProgress(60)
      setStatus('Processing video (this may take a few minutes)...')

      // Check the content type to determine if it's JSON or binary video data
      const contentType = response.headers.get('content-type') || ''
      console.log('Response content-type:', contentType)
      
      let processedUrl = null
      
      // Clone the response so we can read it multiple times if needed
      const responseClone = response.clone()
      
      if (contentType.includes('application/json')) {
        // JSON response with URL
        const result = await response.json()
        console.log('Segmind API JSON response:', result)
        
        if (result.output || result.video_url || result.url) {
          processedUrl = result.output || result.video_url || result.url
        } else {
          console.log('Unexpected JSON response structure:', result)
          throw new Error('Unexpected response format from Segmind API. Check console for details.')
        }
      } else {
        // Try to parse as JSON first (in case content-type is wrong)
        try {
          const text = await response.text()
          // Check if it looks like JSON (starts with { or [)
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const result = JSON.parse(text)
            console.log('Segmind API JSON response (parsed from text):', result)
            
            if (result.output || result.video_url || result.url) {
              processedUrl = result.output || result.video_url || result.url
            } else {
              throw new Error('Unexpected response format from Segmind API.')
            }
          } else {
            // Not JSON, must be binary video data
            throw new Error('Not JSON')
          }
        } catch (jsonError) {
          // If JSON parsing fails, it's binary video data
          console.log('Response is binary video data, creating blob URL')
          const videoBlob = await responseClone.blob()
          processedUrl = URL.createObjectURL(videoBlob)
          console.log('Created blob URL from video data:', processedUrl)
        }
      }
      
      if (processedUrl) {
        setProgress(100)
        setStatus('Watermark removed successfully!')
      console.log('=== PROCESSING COMPLETE ===')
      console.log('Processed video URL:', processedUrl)
      console.log('Original video URL:', finalUrl)
      console.log('Endpoint used:', response.url)
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      // Check if processed video is actually different (basic check)
      if (processedUrl.startsWith('blob:')) {
        console.log('Processed video is a blob (binary data from API)')
        console.log('Note: If watermark is still visible, Segmind API may have limitations with this watermark type')
        console.log('Consider trying alternative APIs like ClipLoom or RemoveMark.io for better results')
      }
      
      console.log('Please compare the videos to verify watermark removal')
      console.log('===========================')
        setProcessedVideoUrl(processedUrl)
      } else {
        throw new Error('Failed to get processed video URL from Segmind API.')
      }

    } catch (err) {
      console.error('Processing error:', err)
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred'
      setError(`Error processing video: ${errorMessage}`)
      setStatus('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (processedVideoUrl) {
      const a = document.createElement('a')
      a.href = processedVideoUrl
      a.download = `watermark-removed-${file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [videoPreviewUrl])

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl">Watermark Remover</CardTitle>
        <CardDescription>
          Remove watermarks (like "pika" or "sora") from your MP4 videos using Segmind AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
          />
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              file
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50 cursor-pointer",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
            onClick={!file ? handleFileAreaClick : undefined}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <Video className="h-12 w-12 text-primary" />
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium text-lg">{file.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                {videoPreviewUrl && (
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="max-w-full max-h-64 rounded-lg mt-2"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleChangeFile}
                  disabled={isProcessing}
                  className="mt-2"
                >
                  Change File
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <span className="font-medium text-lg">Click to select an MP4 video</span>
                <span className="text-sm text-muted-foreground">
                  Maximum file size: 100MB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Status Alert */}
        {status && !error && (
          <Alert>
            {status.includes('successfully') ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing...</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Processed Video Preview */}
        {processedVideoUrl && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Video processed! Compare the original (above) with the processed video (below) to see if the watermark was removed.
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Note: Some watermarks may be difficult to remove completely. If the watermark is still visible, the API may have limitations with this particular watermark type.
                </span>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Processed Video:</h4>
              <video
                src={processedVideoUrl}
                controls
                className="w-full rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Process Button */}
        <Button
          onClick={handleRemoveWatermark}
          disabled={!file || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Remove Watermark'
          )}
        </Button>

        {/* Download Button */}
        {processedVideoUrl && (
          <Button
            onClick={handleDownload}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Processed Video
          </Button>
        )}

        {/* Info Section */}
        <div className="pt-6 border-t space-y-3">
          <h3 className="font-semibold text-lg">How it works:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Upload an MP4 video with a watermark (e.g., "pika" or "sora")</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Click "Remove Watermark" to process your video</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>AI will automatically detect and remove the watermark</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Download your watermark-free video</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default WatermarkRemover

