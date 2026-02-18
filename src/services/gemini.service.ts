
import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, GenerateVideosOperation, GenerateVideosResponse } from "@google/genai";

export type VideoGenerationStatus = {
  status: 'processing' | 'done' | 'error';
  message: string;
  videoUrl?: string;
  progress?: number;
};

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly API_KEY = process.env.API_KEY;

  videoGenerationStatus = signal<VideoGenerationStatus | null>(null);

  constructor() {
    if (!this.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: this.API_KEY });
  }

  async fileToGenerativePart(file: File): Promise<{ inlineData: { data: string, mimeType: string } }> {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    const base64EncodedData = await base64EncodedDataPromise;
    return {
      inlineData: {
        data: base64EncodedData,
        mimeType: file.type,
      },
    };
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error generating text:', error);
      throw new Error('ไม่สามารถสร้างข้อความได้');
    }
  }

  async describeImage(prompt: string, imageFile: File): Promise<string> {
    try {
      const imagePart = await this.fileToGenerativePart(imageFile);
      const textPart = { text: prompt };

      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
      });

      return response.text;
    } catch (error) {
      console.error('Error describing image:', error);
      throw new Error('ไม่สามารถวิเคราะห์รูปภาพได้');
    }
  }

  async generateVideo(prompt: string, imageFile?: File): Promise<string> {
      this.videoGenerationStatus.set({ status: 'processing', message: 'กำลังเริ่มต้นการสร้างวิดีโอ...', progress: 0 });
      try {
        let operation: GenerateVideosOperation;
        if(imageFile) {
            const imagePart = await this.fileToGenerativePart(imageFile);
            operation = await this.ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt: prompt,
                image: {
                    imageBytes: imagePart.inlineData.data,
                    mimeType: imagePart.inlineData.mimeType
                },
                config: { numberOfVideos: 1 }
            });
        } else {
            operation = await this.ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt: prompt,
                config: { numberOfVideos: 1 }
            });
        }

        this.videoGenerationStatus.set({ status: 'processing', message: 'ได้รับคำสั่งแล้ว กำลังประมวลผล...', progress: 25 });
        
        let progress = 25;
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await this.ai.operations.getVideosOperation({ operation: operation });
            progress = Math.min(progress + 10, 90);
            this.videoGenerationStatus.set({ status: 'processing', message: 'AI กำลังสร้างสรรค์ผลงาน... อาจใช้เวลาสักครู่', progress });
        }
        
        this.videoGenerationStatus.set({ status: 'processing', message: 'การประมวลผลใกล้เสร็จสมบูรณ์...', progress: 95 });

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
          throw new Error('ไม่พบลิงก์วิดีโอในผลลัพธ์');
        }

        const videoResponse = await fetch(`${downloadLink}&key=${this.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        this.videoGenerationStatus.set({ status: 'done', message: 'สร้างวิดีโอสำเร็จ!', videoUrl, progress: 100 });
        return videoUrl;
      } catch (error) {
        console.error('Error generating video:', error);
        this.videoGenerationStatus.set({ status: 'error', message: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : String(error)}` });
        throw new Error('ไม่สามารถสร้างวิดีโอได้');
      }
  }
}
