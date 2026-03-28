import { Plugin, TFile } from 'obsidian';
import { renderPayload } from './processor';
import { PayloadSettings, DEFAULT_SETTINGS, PayloadSettingTab } from './settings';
import { PayloadModal } from './modal';
import { syncMdToTxt, syncTxtToMd } from './sync';

export default class PayloadPlugin extends Plugin {
    settings: PayloadSettings;

    async onload() {
        console.log('✅ Payload Plugin is starting...');
        
        await this.loadSettings();
        this.addSettingTab(new PayloadSettingTab(this.app, this));
        this.applySettings();

        // Register vault events for file binding sync
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    if (file.extension === 'md') {
                        syncMdToTxt(this.app, this.settings, file);
                    } else if (file.extension === 'txt') {
                        syncTxtToMd(this.app, this.settings, file);
                    }
                }
            })
        );

        // Ribbon Icon
        this.addRibbonIcon('box', '添加 Payload 卡片', () => {
            new PayloadModal(this.app, this.settings).open();
        });

        // Command
        this.addCommand({
            id: 'insert-payload-card',
            name: '插入 Payload 卡片',
            editorCallback: (editor, view) => {
                new PayloadModal(this.app, this.settings, editor).open();
            }
        });

        // Register the markdown code block processor
        this.registerMarkdownCodeBlockProcessor("payload", (source, el, ctx) => {
            try {
                renderPayload(this.app, this.settings, source, el, ctx);
            } catch (err) {
                console.error("❌ Error rendering payload block:", err);
            }
        });
        
        console.log('✅ Payload Plugin loaded successfully!');
    }

    onunload() {
        console.log('🛑 Payload Plugin unloaded.');
        document.body.style.removeProperty('--payload-custom-accent');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    applySettings() {
        if (this.settings.useCustomColor && this.settings.customColor) {
            // Convert Hex to RGB for color-mix compatibility
            const hex = this.settings.customColor;
            let r = 8, g = 109, b = 221; // fallback
            if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
                let c = hex.substring(1).split('');
                if (c.length === 3) {
                    c = [c[0]||'0', c[0]||'0', c[1]||'0', c[1]||'0', c[2]||'0', c[2]||'0'];
                }
                const num = parseInt(c.join(''), 16);
                r = (num >> 16) & 255;
                g = (num >> 8) & 255;
                b = num & 255;
            }
            document.body.style.setProperty('--payload-custom-accent', `${r}, ${g}, ${b}`);
        } else {
            document.body.style.removeProperty('--payload-custom-accent');
        }
    }
}
