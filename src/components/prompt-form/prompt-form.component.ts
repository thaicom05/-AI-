
import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export type TabType = 'textToVideo' | 'imageToVideo' | 'imageToText';

@Component({
  selector: 'app-prompt-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './prompt-form.component.html',
})
export class PromptFormComponent {
  prompt = signal('');
  selectedFile = signal<File | null>(null);
  activeTab = signal<TabType>('textToVideo');

  submitPrompt = output<{ prompt: string; file: File | null; tab: TabType }>();

  selectTab(tab: TabType) {
    this.activeTab.set(tab);
    this.selectedFile.set(null); // Reset file on tab change
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile.set(input.files[0]);
    }
  }

  onSubmit(): void {
    if (this.prompt().trim() || this.selectedFile()) {
      this.submitPrompt.emit({ prompt: this.prompt(), file: this.selectedFile(), tab: this.activeTab() });
      this.prompt.set('');
      // Keep file for potential re-submission
    }
  }

  triggerFileInput(fileInput: HTMLInputElement) {
    fileInput.click();
  }
}
