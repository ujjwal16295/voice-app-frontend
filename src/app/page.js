"use client"
import React, { useState, useRef } from 'react';
import { Upload, Mic, Download, Loader2, Music, Trash2, Play, Pause, Volume2, RotateCcw } from 'lucide-react';

export default function AudioSeparator() {
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingType, setPlayingType] = useState(null);
  const [isPreviewingRecording, setIsPreviewingRecording] = useState(false);
  
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const recordingPreviewRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  const API_BASE_URL = 'https://voice-ai-backend-zry9.onrender.com';

  // File upload handler
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRecordedBlob(null);
      setSessionId(null);
      setIsPreviewingRecording(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use a more compatible format
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' };
        if (!MediaRecorder.isTypeSupported('audio/mp4')) {
          options = {}; // Use default
        }
      }
      
      const recorder = new MediaRecorder(stream, options);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/wav';
        const blob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(blob);
        setFile(null);
        setSessionId(null);
        setIsPreviewingRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  // Preview recorded audio
  const previewRecording = () => {
    if (!recordedBlob) return;

    try {
      if (isPreviewingRecording) {
        recordingPreviewRef.current.pause();
        setIsPreviewingRecording(false);
        return;
      }

      const url = window.URL.createObjectURL(recordedBlob);
      recordingPreviewRef.current.src = url;
      recordingPreviewRef.current.play();
      setIsPreviewingRecording(true);
      
      recordingPreviewRef.current.onended = () => {
        setIsPreviewingRecording(false);
        window.URL.revokeObjectURL(url);
      };

      recordingPreviewRef.current.onpause = () => {
        setIsPreviewingRecording(false);
      };
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  // Delete recording
  const deleteRecording = () => {
    if (isPreviewingRecording) {
      recordingPreviewRef.current.pause();
      setIsPreviewingRecording(false);
    }
    setRecordedBlob(null);
    setRecordingTime(0);
  };

  // Process audio (upload or recorded)
  const processAudio = async () => {
    const audioToProcess = file || recordedBlob;
    if (!audioToProcess) {
      alert('Please select a file or record audio first');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    
    if (file) {
      formData.append('audio', file);
    } else {
      // Create a filename with appropriate extension based on the blob type
      const mimeType = recordedBlob.type || 'audio/wav';
      let extension = 'wav';
      if (mimeType.includes('webm')) extension = 'webm';
      else if (mimeType.includes('mp4')) extension = 'mp4';
      else if (mimeType.includes('ogg')) extension = 'ogg';
      
      formData.append('audio', recordedBlob, `recording.${extension}`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setSessionId(result.session_id);
        alert('Audio processed successfully! You can now download the separated tracks.');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      alert('Failed to process audio. Please make sure the Flask server is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download files
  const downloadFile = async (fileType) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/download/${sessionId}/${fileType}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileType}.wav`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  // Play preview
  const playPreview = async (fileType) => {
    if (!sessionId) return;

    try {
      if (isPlaying && playingType === fileType) {
        audioRef.current.pause();
        setIsPlaying(false);
        setPlayingType(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/download/${sessionId}/${fileType}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
          setPlayingType(fileType);
          
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setPlayingType(null);
            window.URL.revokeObjectURL(url);
          };
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  // Clean up session
  const cleanupSession = async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/cleanup/${sessionId}`, {
        method: 'DELETE',
      });
      setSessionId(null);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset all states
  const resetAll = () => {
    setFile(null);
    setRecordedBlob(null);
    setSessionId(null);
    setIsPlaying(false);
    setPlayingType(null);
    setIsPreviewingRecording(false);
    setRecordingTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (recordingPreviewRef.current) {
      recordingPreviewRef.current.pause();
      recordingPreviewRef.current.src = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center mb-6">
            <div className="bg-white/10 backdrop-blur-md rounded-full p-4">
              <Music className="w-12 h-12 text-purple-300" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            AI Voice Separator
          </h1>
          <p className="text-xl text-purple-200 max-w-2xl mx-auto">
            Remove background music from vocals or extract instrumental tracks using advanced AI technology
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
            
            {/* Upload Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6">Upload Audio File</h2>
              <div className="border-2 border-dashed border-purple-300/50 rounded-xl p-8 text-center hover:border-purple-300 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".mp3,.wav,.flac,.m4a"
                  className="hidden"
                />
                <Upload className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                <p className="text-white mb-4">
                  {file ? file.name : 'Drag & drop your audio file here or click to browse'}
                </p>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Choose File
                </button>
                <p className="text-sm text-purple-200 mt-2">
                  Supported formats: MP3, WAV, FLAC, M4A
                </p>
              </div>
            </div>

            {/* OR Divider */}
            <div className="flex items-center mb-8">
              <div className="flex-1 h-px bg-purple-300/30"></div>
              <span className="text-purple-200 px-4 text-lg font-medium">OR</span>
              <div className="flex-1 h-px bg-purple-300/30"></div>
            </div>

            {/* Recording Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6">Record Audio</h2>
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <Mic className={`w-12 h-12 mx-auto mb-4 ${isRecording ? 'text-red-400 animate-pulse' : 'text-purple-300'}`} />
                
                {isRecording && (
                  <div className="text-red-400 text-xl font-mono mb-4">
                    Recording: {formatTime(recordingTime)}
                  </div>
                )}
                
                {recordedBlob && !isRecording && (
                  <div className="mb-6">
                    <div className="text-green-400 mb-4">
                      ✓ Recording completed ({formatTime(recordingTime)})
                    </div>
                    
                    {/* Recording Preview Controls */}
                    <div className="bg-white/10 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-center gap-4 mb-3">
                        <Volume2 className="w-5 h-5 text-purple-300" />
                        <span className="text-white font-medium">Preview Your Recording</span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={previewRecording}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            isPreviewingRecording
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isPreviewingRecording ? (
                            <>
                              <Pause className="w-4 h-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Play
                            </>
                          )}
                        </button>
                        <button
                          onClick={deleteRecording}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            deleteRecording();
                            // Small delay to ensure state is reset
                            setTimeout(() => {
                              startRecording();
                            }, 100);
                          }}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Re-record
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={recordedBlob && !isRecording}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : recordedBlob && !isRecording
                      ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isRecording ? 'Stop Recording' : recordedBlob ? 'Recording Complete' : 'Start Recording'}
                </button>
              </div>
            </div>

            {/* Process Button */}
            <div className="text-center mb-8">
              <button
                onClick={processAudio}
                disabled={isProcessing || (!file && !recordedBlob)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-12 py-4 rounded-xl font-semibold text-lg transition-all disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing Audio...
                  </>
                ) : (
                  <>
                    <Music className="w-6 h-6" />
                    Separate Audio
                  </>
                )}
              </button>
            </div>

            {/* Results Section */}
            {sessionId && (
              <div className="bg-white/5 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-6 text-center">
                  Separated Audio Tracks
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* Vocals */}
                  <div className="bg-white/10 rounded-lg p-6 text-center">
                    <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mic className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-4">Vocals Only</h4>
                    <div className="space-y-3">
                      <button
                        onClick={() => playPreview('vocals')}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isPlaying && playingType === 'vocals' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isPlaying && playingType === 'vocals' ? 'Pause' : 'Preview'}
                      </button>
                      <button
                        onClick={() => downloadFile('vocals')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Instrumental */}
                  <div className="bg-white/10 rounded-lg p-6 text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Music className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-4">Instrumental</h4>
                    <div className="space-y-3">
                      <button
                        onClick={() => playPreview('instrumental')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isPlaying && playingType === 'instrumental' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isPlaying && playingType === 'instrumental' ? 'Pause' : 'Preview'}
                      </button>
                      <button
                        onClick={() => downloadFile('instrumental')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                <div className="text-center mt-6">
                  <button
                    onClick={() => {
                      cleanupSession();
                      resetAll();
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Process New Audio
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden audio elements */}
        <audio ref={audioRef} />
        <audio ref={recordingPreviewRef} />
      </div>
    </div>
  );
}