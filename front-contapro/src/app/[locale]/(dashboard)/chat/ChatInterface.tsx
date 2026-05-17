"use client";
import { BASE } from "@/lib/api";

import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowUp, Plus, Mic, X, Loader2, Image as ImageIcon, FileText, Camera, StopCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  file?: {
    name: string;
    type: string;
    url?: string;
  };
};

export default function ChatInterface() {
  const t = useTranslations('Chat');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('welcomeMessage')
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedFilePreviewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSend = async (textToSend: string = input) => {
    if ((!textToSend.trim() && !selectedFile) || isSending) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      file: selectedFile ? {
        name: selectedFile.name,
        type: selectedFile.type,
        url: URL.createObjectURL(selectedFile)
      } : undefined
    };

    setMessages(prev => [...prev, newMessage]);
    const currentInput = textToSend;
    if (input === textToSend) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
    setIsSending(true);

    const formData = new FormData();
    if (currentInput.trim()) formData.append('text', currentInput);
    if (selectedFile) formData.append('file', selectedFile);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
      const res = await fetch(`${baseUrl}/api/chat/message`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || t('defaultReply')
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('errorConnection')
      }]);
    } finally {
      setIsSending(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'audio-message.webm', { type: 'audio/webm' });
        setSelectedFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      // Podrías mostrar un toast aquí
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAttachmentSelect = (type: 'image' | 'document') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : 'application/pdf,.doc,.docx,.xls,.xlsx';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col h-full relative text-white">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar scroll-smooth"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col max-w-[85%] md:max-w-[80%] gap-1`}>
              
              {/* Bubble */}
              <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start mt-2'}`}>
                
                {/* File Attachment */}
                {msg.file && (
                  <div className="mb-1">
                    {msg.file.type.startsWith('image/') && msg.file.url ? (
                      <div className="relative w-48 h-auto rounded-2xl overflow-hidden border border-white/20 shadow-xl">
                        <img src={msg.file.url} alt={msg.file.name} className="w-full h-auto object-cover" />
                      </div>
                    ) : msg.file.type.startsWith('audio/') && msg.file.url ? (
                      <div className="bg-[#1a1a1a]/80 border border-white/20 rounded-[2rem] p-1 flex items-center backdrop-blur-md shadow-lg overflow-hidden shrink-0">
                        <audio controls src={msg.file.url} className="h-11 w-64 outline-none filter invert contrast-125 hue-rotate-180 opacity-90 transition-all hover:opacity-100" />
                      </div>
                    ) : (
                      <div className="bg-white/10 border border-white/20 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-md shadow-lg">
                        {msg.file.type.startsWith('audio/') ? (
                           <Mic className="w-5 h-5 text-emerald-400" />
                        ) : (
                           <FileText className="w-5 h-5 text-rose-400" />
                        )}
                        <span className="text-sm text-white/90 truncate max-w-[150px] font-medium">{msg.file.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Content */}
                {msg.content && (
                  <div className={`px-5 py-4 rounded-[2rem] whitespace-pre-wrap text-[15px] leading-relaxed shadow-xl backdrop-blur-3xl border transition-all duration-300 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border-white/20 text-white rounded-tr-md' 
                      : 'bg-white/5 border-white/10 text-white/90 rounded-tl-md'
                  }`}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex flex-col max-w-[85%] gap-1 mt-2">
              <div className="px-5 py-4 rounded-[2rem] rounded-tl-md bg-white/5 border border-white/10 text-white/60 backdrop-blur-3xl shadow-xl flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('typing')}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 md:px-6 pb-6">
        
        {/* Selected File Preview */}
        {selectedFile && (
          <div className="mb-3 inline-flex items-center gap-2 relative group">
            <div className={`flex items-center gap-3 p-2 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-xl ${selectedFile.type.startsWith('audio/') ? 'pr-12' : 'pr-4'}`}>
              {selectedFile.type.startsWith('image/') ? (
                 <>
                   <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 ml-1">
                     <ImageIcon className="w-4 h-4 text-indigo-300" />
                   </div>
                   <span className="text-sm text-white/90 max-w-[200px] truncate">{selectedFile.name}</span>
                 </>
              ) : selectedFile.type.startsWith('audio/') && selectedFilePreviewUrl ? (
                 <div className="rounded-xl overflow-hidden flex items-center">
                   <audio controls src={selectedFilePreviewUrl} className="h-10 w-64 outline-none filter invert contrast-125 hue-rotate-180 opacity-90 transition-all hover:opacity-100" />
                 </div>
              ) : (
                 <>
                   <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500/20 ml-1">
                     <FileText className="w-4 h-4 text-rose-300" />
                   </div>
                   <span className="text-sm text-white/90 max-w-[200px] truncate">{selectedFile.name}</span>
                 </>
              )}
            </div>
            
            <button 
              type="button"
              onClick={() => setSelectedFile(null)}
              className={`flex items-center justify-center w-8 h-8 bg-black/40 border border-white/10 text-white/80 hover:bg-red-500/80 hover:text-white rounded-full transition-colors ${selectedFile.type.startsWith('audio/') ? 'absolute right-2 top-1/2 -translate-y-1/2' : ''}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Glass Input Box */}
        <div className="flex items-end gap-2 bg-white/[0.03] border border-white/10 rounded-[2rem] p-1.5 pl-2 pr-1.5 shadow-2xl focus-within:bg-white/10 focus-within:border-white/20 transition-all duration-500 backdrop-blur-3xl ring-1 ring-white/5 relative">
          
          {isRecording && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,application/pdf,audio/*"
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                type="button"
                className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0 mb-0.5 active:scale-90"
                title={t('attachFile')}
              >
                <Plus className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-[#1a1a1a] border-white/10 text-white rounded-xl mb-2">
              <DropdownMenuItem onClick={() => handleAttachmentSelect('image')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 rounded-lg py-2.5">
                <Camera className="w-4 h-4 mr-2 text-indigo-400" />
                <span>Foto o Imagen</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAttachmentSelect('document')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 rounded-lg py-2.5">
                <FileText className="w-4 h-4 mr-2 text-rose-400" />
                <span>Documento (PDF)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Grabando audio..." : t('inputPlaceholder')}
            disabled={isRecording}
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-white placeholder:text-white/30 resize-none max-h-32 min-h-[44px] py-3 px-1 custom-scrollbar text-[15px] font-medium leading-relaxed"
            rows={1}
            style={{ height: "auto" }}
          />

          <div className="flex items-center gap-1 mb-0.5 shrink-0">
            {isRecording ? (
              <button 
                type="button"
                onClick={stopRecording}
                className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full transition-all active:scale-90"
                title="Detener grabación"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={startRecording}
                className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
                title={t('recordAudio')}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}

            <button 
              type="button"
              onClick={() => handleSend(input)}
              disabled={(!input.trim() && !selectedFile) || isSending || isRecording}
              className={`p-2.5 rounded-full transition-all flex items-center justify-center border ${
                (!input.trim() && !selectedFile) || isSending || isRecording
                  ? 'border-transparent text-white/20 bg-transparent'
                  : 'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/10'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
