
import { Component, ChangeDetectionStrategy, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PromptFormComponent, TabType } from './components/prompt-form/prompt-form.component';
import { GeminiService } from './services/gemini.service';

interface Message {
  id: number;
  role: 'user' | 'model';
  type: 'text' | 'image' | 'video' | 'loading' | 'error';
  content: string;
  filePreview?: string;
  videoStatus?: {
      message: string;
      progress: number;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, PromptFormComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  messages = signal<Message[]>([]);
  private lastId = 0;

  constructor() {
    effect(() => {
        const videoStatus = this.geminiService.videoGenerationStatus();
        if (videoStatus && videoStatus.status === 'processing') {
            this.messages.update(currentMessages => {
                const loadingMsgIndex = currentMessages.findIndex(m => m.type === 'loading');
                if (loadingMsgIndex !== -1) {
                    const updatedMessages = [...currentMessages];
                    updatedMessages[loadingMsgIndex] = {
                        ...updatedMessages[loadingMsgIndex],
                        videoStatus: {
                            message: videoStatus.message,
                            progress: videoStatus.progress || 0
                        }
                    };
                    return updatedMessages;
                }
                return currentMessages;
            });
        }
    });
  }


  async handlePrompt(event: { prompt: string; file: File | null; tab: TabType }): Promise<void> {
    
    // Add user message
    const userMessageContent = event.prompt || `ไฟล์ที่อัปโหลด: ${event.file?.name}`;
    const userMessage: Message = { 
        id: ++this.lastId,
        role: 'user', 
        type: 'text', 
        content: userMessageContent,
        filePreview: event.file ? URL.createObjectURL(event.file) : undefined
    };
    this.messages.update(m => [...m, userMessage]);

    // Add loading message
    const loadingMessageId = ++this.lastId;
    const loadingMessage: Message = { 
        id: loadingMessageId, 
        role: 'model', 
        type: 'loading', 
        content: 'AI กำลังคิด...' 
    };
    this.messages.update(m => [...m, loadingMessage]);

    try {
      let result: Message;

      switch (event.tab) {
        case 'textToVideo':
          const videoUrl = await this.geminiService.generateVideo(event.prompt);
          result = { id: loadingMessageId, role: 'model', type: 'video', content: videoUrl };
          break;
        case 'imageToVideo':
          if (!event.file) throw new Error('กรุณาอัปโหลดรูปภาพ');
          const videoUrlFromImage = await this.geminiService.generateVideo(event.prompt, event.file);
          result = { id: loadingMessageId, role: 'model', type: 'video', content: videoUrlFromImage };
          break;
        case 'imageToText':
          if (!event.file) throw new Error('กรุณาอัปโหลดรูปภาพ');
          const description = await this.geminiService.describeImage(event.prompt || 'ช่วยอธิบายภาพนี้หน่อย', event.file);
          result = { id: loadingMessageId, role: 'model', type: 'text', content: description };
          break;
        default:
          throw new Error('ประเภทการดำเนินการที่ไม่รู้จัก');
      }

      this.updateMessage(loadingMessageId, result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
      const errorResult: Message = { id: loadingMessageId, role: 'model', type: 'error', content: errorMessage };
      this.updateMessage(loadingMessageId, errorResult);
    }
  }

  private updateMessage(id: number, newMessage: Partial<Message>): void {
    this.messages.update(currentMessages => 
      currentMessages.map(m => m.id === id ? { ...m, ...newMessage } : m)
    );
  }
}
