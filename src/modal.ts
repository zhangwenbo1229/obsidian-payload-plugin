import { App, Modal, Setting, MarkdownView, TFile, Notice, Editor } from 'obsidian';
import { PayloadData } from './processor';
import { PayloadSettings } from './settings';

export class PayloadModal extends Modal {
    settings: PayloadSettings;
    data: PayloadData;
    editor?: Editor;
    file?: TFile;
    lineStart?: number;
    lineEnd?: number;
    
    syntaxesContainer: HTMLElement;

    constructor(app: App, settings: PayloadSettings, editor?: Editor, existingData?: PayloadData, file?: TFile, lineStart?: number, lineEnd?: number) {
        super(app);
        this.settings = settings;
        this.editor = editor;
        this.file = file;
        this.lineStart = lineStart;
        this.lineEnd = lineEnd;
        
        this.data = existingData ? JSON.parse(JSON.stringify(existingData)) : {
            step: '',
            title: '',
            description: '',
            scope: '',
            language: 'plaintext',
            code: '',
            syntaxes: []
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.file ? '编辑 Payload 卡片' : '新增 Payload 卡片' });

        new Setting(contentEl).setName('序号 (Step)').setDesc('例如: 1').addText(text => text.setValue(this.data.step || '').onChange(val => this.data.step = val));
        new Setting(contentEl).setName('标题 (Title)').addText(text => text.setValue(this.data.title || '').onChange(val => this.data.title = val));
        new Setting(contentEl).setName('描述 (Description)').addTextArea(text => { text.setValue(this.data.description || '').onChange(val => this.data.description = val); text.inputEl.rows = 3; text.inputEl.style.width = '100%'; });
        new Setting(contentEl).setName('适用范围 (Scope)').setDesc('例如: Windows').addText(text => text.setValue(this.data.scope || '').onChange(val => this.data.scope = val));
        
        contentEl.createEl('h3', { text: '语法解析 (可选)', cls: 'payload-modal-section' });
        this.syntaxesContainer = contentEl.createDiv();
        this.renderSyntaxes();

        new Setting(contentEl).addButton(btn => btn.setButtonText('+ 添加解析参数').onClick(() => {
            if (!this.data.syntaxes) this.data.syntaxes = [];
            this.data.syntaxes.push({ type: '参数', code: '', description: '' });
            this.renderSyntaxes();
        }));

        contentEl.createEl('h3', { text: '核心代码 (Code) *必填', cls: 'payload-modal-section' });
        
        new Setting(contentEl).setName('代码语言 (Language)').addDropdown(cb => {
            this.settings.languages.forEach(lang => cb.addOption(lang, lang));
            // default to first language if current is not in list or not set
            const currentLang = this.data.language || 'plaintext';
            cb.setValue(this.settings.languages.includes(currentLang) ? currentLang : (this.settings.languages[0] || 'plaintext'));
            this.data.language = cb.getValue(); // ensure data matches dropdown
            cb.onChange(val => this.data.language = val);
        });

        new Setting(contentEl).addTextArea(text => {
            text.setValue(this.data.code || '').onChange(val => this.data.code = val);
            text.inputEl.rows = 6;
            text.inputEl.style.width = '100%';
            text.inputEl.style.fontFamily = 'var(--font-monospace)';
        });

        new Setting(contentEl)
            .addButton(btn => btn.setButtonText('取消').onClick(() => this.close()))
            .addButton(btn => btn.setButtonText(this.file ? '保存修改' : '插入卡片').setCta().onClick(() => this.submit()));
    }

    renderSyntaxes() {
        this.syntaxesContainer.empty();
        if(!this.data.syntaxes) return;
        
        this.data.syntaxes.forEach((syn, index) => {
            const div = this.syntaxesContainer.createDiv({ attr: { style: 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;' } });
            const typeInput = div.createEl('input', { attr: { type: 'text', value: syn.type, placeholder: '类型(如:参数)' } });
            typeInput.style.width = '80px';
            typeInput.onchange = (e) => syn.type = (e.target as HTMLInputElement).value;
            
            const codeInput = div.createEl('input', { attr: { type: 'text', value: syn.code, placeholder: '代码(如:-c All)' } });
            codeInput.style.width = '120px';
            codeInput.onchange = (e) => syn.code = (e.target as HTMLInputElement).value;

            const descInput = div.createEl('input', { attr: { type: 'text', value: syn.description, placeholder: '描述' } });
            descInput.style.flexGrow = '1';
            descInput.onchange = (e) => syn.description = (e.target as HTMLInputElement).value;

            const delBtn = div.createEl('button', { text: '删除' });
            delBtn.onclick = () => {
                this.data.syntaxes.splice(index, 1);
                this.renderSyntaxes();
            };
        });
    }

    async submit() {
        if (!this.data.code || this.data.code.trim() === '') {
            new Notice('核心代码不能为空！');
            return;
        }

        let md = "```payload\n";
        if (this.data.step && this.data.step.trim() !== '') md += `[${this.data.step.trim()}]\n`;
        if (this.data.title && this.data.title.trim() !== '') md += `# ${this.data.title.trim()}\n`;
        if (this.data.description && this.data.description.trim() !== '') {
            this.data.description.trimEnd().split('\n').forEach(l => {
                md += `> ${l}\n`;
            });
        }
        if (this.data.scope && this.data.scope.trim() !== '') md += `@ ${this.data.scope.trim()}\n`;
        if (this.data.language && this.data.language.trim() !== '' && this.data.language !== 'plaintext') md += `$ ${this.data.language.trim()}\n`;
        
        if (this.data.syntaxes && this.data.syntaxes.length > 0) {
            this.data.syntaxes.forEach(s => {
                if(s.type || s.code || s.description) {
                    md += `? ${s.type || ' '} | ${s.code || ' '} | ${s.description || ' '}\n`;
                }
            });
        }
        md += `\n${this.data.code.replace(/\n$/, '')}\n`;
        md += "```\n";

        if (this.file && this.lineStart !== undefined && this.lineEnd !== undefined) {
            // Edit Mode
            const content = await this.app.vault.read(this.file);
            const lines = content.split('\n');
            lines.splice(this.lineStart, this.lineEnd - this.lineStart + 1, md.trim());
            await this.app.vault.modify(this.file, lines.join('\n'));
            new Notice('卡片已更新');
        } else {
            // Insert Mode
            let activeEditor = this.editor;
            if (!activeEditor) {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) activeEditor = view.editor;
            }

            if (activeEditor) {
                const cursor = activeEditor.getCursor();
                activeEditor.replaceRange(md, cursor);
                new Notice('卡片已插入');
            } else {
                new Notice('未找到活动的编辑器，无法插入卡片。');
            }
        }
        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
