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
              // This is the download page URL. The direct file URL is: https://tmpfiles.org/[id]/filename
              const originalUrl = result.data.url
              const directUrl = originalUrl.replace('/dl/', '/')
              
              console.log('tmpfiles.org original URL (with /dl/):', originalUrl)
              console.log('tmpfiles.org direct URL (without /dl/):', directUrl)
              
              // Use the direct URL (without /dl/) as it should provide direct file access
              // which is what APIs typically need
              return directUrl
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
      'Failed to upload video to temporary storage after trying multiple services. ' +
      'This may be due to network issues or service unavailability. ' +
      'For production use, consider setting up a backend endpoint or using a service like Cloudinary. ' +
      'See README.md for more options.'
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
      console.log('Video URL to send to Segmind:', videoUrl)
      console.log('Video file name:', file.name)
      console.log('Video file size:', (file.size / (1024 * 1024)).toFixed(2), 'MB')
      
      // Note: We can't easily verify URL accessibility from browser due to CORS,
      // but Segmind will try to access it. If it fails, we'll get a clear error.
      
      setStatus('Sending request to Segmind API...')
      
      // Step 3: Call Segmind API for watermark removal
      const response = await fetch('https://api.segmind.com/v1/video-watermark-remover', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_video: videoUrl,
          base64: false // Set to true if you want base64 output instead of URL
        })
      })
      
      console.log('Segmind API request sent. Waiting for response...')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        let errorMessage = 'Failed to process video'
        
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
          // If it's a video duration error, provide more helpful context
          if (errorMessage.includes('duration') || errorMessage.includes('Could not determine')) {
            errorMessage += ' This may mean the video URL is not accessible or the video format is not supported. Try a different video or check the video URL in the browser console.'
          }
        }
        
        console.error('Segmind API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          videoUrl
        })
        
        throw new Error(errorMessage)
      }

      setProgress(60)
      setStatus('Processing video (this may take a few minutes)...')

      const result = await response.json()
      
      // Segmind API returns the processed video URL directly
      if (result.output || result.video_url || result.url) {
        const processedUrl = result.output || result.video_url || result.url
        
        setProgress(100)
        setStatus('Watermark removed successfully!')
        setProcessedVideoUrl(processedUrl)
      } else {
        // If response structure is different, log it for debugging
        console.log('Segmind API response:', result)
        throw new Error('Unexpected response format from Segmind API. Check console for details.')
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
          <div className="space-y-2">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>Watermark removed! Preview your video below.</AlertDescription>
            </Alert>
            <video
              src={processedVideoUrl}
              controls
              className="w-full rounded-lg"
            />
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

