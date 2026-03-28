import { App, MarkdownPostProcessorContext, Notice, setIcon, TFile, MarkdownRenderer, Component } from 'obsidian';
import { PayloadModal } from './modal';
import { PayloadSettings } from './settings';

export interface SyntaxItem {
    type: string;
    code: string;
    description: string;
}

export interface PayloadData {
    step?: string;
    title?: string;
    description: string;
    scope?: string;
    language?: string;
    syntaxes: SyntaxItem[];
    code: string;
}

export function parsePayload(source: string): PayloadData {
    const lines = source.split('\n');
    let step, title, scope, language;
    let description = '';
    let code = '';
    const syntaxes: SyntaxItem[] = [];
    let inCode = false;

    for (const line of lines) {
        if (!line && line !== '') continue;
        
        if (!inCode) {
            const stepMatch = line.trim().match(/^\[(\d+)\]/);
            if (stepMatch) {
                step = stepMatch[1];
            } else if (line.trim().startsWith('# ')) {
                title = line.trim().substring(2).trim();
            } else if (line.trim().startsWith('>')) {
                let text = line.trim().substring(1);
                if (text.startsWith(' ')) text = text.substring(1);
                description += text + '\n';
            } else if (line.trim().startsWith('@ ')) {
                scope = line.trim().substring(2).trim();
            } else if (line.trim().startsWith('$ ')) {
                language = line.trim().substring(2).trim();
            } else if (line.trim().startsWith('? ')) {
                const parts = line.trim().substring(2).split('|').map(s => s.trim());
                if (parts.length >= 3) {
                    syntaxes.push({ 
                        type: parts[0] || '', 
                        code: parts[1] || '', 
                        description: parts.slice(2).join('|') 
                    });
                }
            } else if (line.trim() === '') {
            } else {
                inCode = true;
                code += line + '\n';
            }
        } else {
            code += line + '\n';
        }
    }
    return { step, title, description: description.trim(), scope, language, syntaxes, code: code.trim() };
}

export function renderPayload(app: App, settings: PayloadSettings, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const data = parsePayload(source);

    // Main Container
    const card = el.createDiv({ cls: 'payload-container payload-card' });

    // 1. Header Area
    const hasHeader = data.step || data.title || data.description || data.scope;
    if (hasHeader) {
        const header = card.createDiv({ cls: 'payload-header' });
        const titleArea = header.createDiv({ cls: 'payload-title-area' });
        
        // title row contains step and title
        if (data.step || data.title) {
            const titleRow = titleArea.createDiv({ cls: 'payload-title-row' });
            if (data.step) {
                titleRow.createDiv({ cls: 'payload-step', text: data.step });
            }
            if (data.title) {
                titleRow.createDiv({ cls: 'payload-title', text: data.title });
            }
        }

        if (data.description) {
            const descEl = titleArea.createDiv({ cls: 'payload-desc' });
            MarkdownRenderer.renderMarkdown(data.description, descEl, ctx.sourcePath, new Component());
        }

        if (data.scope) {
            const scopeBadge = header.createDiv({ cls: 'payload-scope' });
            const scopeLower = data.scope.toLowerCase();
            const iconSpan = scopeBadge.createSpan({ cls: 'payload-scope-icon' });
            if (scopeLower.includes('win')) setIcon(iconSpan, 'layout-dashboard');
            else if (scopeLower.includes('linux')) setIcon(iconSpan, 'terminal');
            else if (scopeLower.includes('mac') || scopeLower.includes('apple')) setIcon(iconSpan, 'command');
            else if (scopeLower.includes('web')) setIcon(iconSpan, 'globe');
            else setIcon(iconSpan, 'box');
            scopeBadge.createSpan({ text: data.scope, cls: 'payload-scope-text' });
        }
    }

    // 2. Code Area
    if (data.code) {
        const codeWrapper = card.createDiv({ cls: 'payload-code-wrapper' });
        const codeBlock = codeWrapper.createDiv({ cls: 'payload-code-block' });
        
        // --- Code Scroll Area ---
        const scrollArea = codeBlock.createDiv({ cls: 'payload-code-scroll-area' });
        
        let renderLang = data.language || "plaintext";
        if (renderLang === 'yak') renderLang = 'python';

        // Use Obsidian's native MarkdownRenderer to get syntax highlighting
        const mdString = "```" + renderLang + "\n" + data.code + "\n```";
        MarkdownRenderer.renderMarkdown(mdString, scrollArea, ctx.sourcePath, new Component());
    }

    // 3. Syntax Explanations
    let syntaxesArea: HTMLElement | null = null;
    if (data.syntaxes.length > 0) {
        syntaxesArea = card.createDiv({ cls: 'payload-syntaxes' });
        syntaxesArea.style.display = 'none';

        data.syntaxes.forEach(syn => {
            const synRow = syntaxesArea!.createDiv({ cls: 'payload-syntax-row' });
            const leftCol = synRow.createDiv({ cls: 'payload-syntax-left' });
            leftCol.createDiv({ cls: 'payload-syntax-code', text: syn.code });
            leftCol.createDiv({ cls: 'payload-syntax-type', text: syn.type });
            const rightCol = synRow.createDiv({ cls: 'payload-syntax-right' });
            rightCol.createDiv({ cls: 'payload-syntax-desc', text: syn.description });
        });
    }

    // 4. Footer Actions
    const footer = card.createDiv({ cls: 'payload-footer' });

    // Language Badge (Moved to footer left)
    if (data.language && data.language !== 'plaintext') {
        footer.createDiv({ cls: 'payload-code-lang', text: data.language });
    } else {
        // Create an empty div to maintain space-between layout if no language
        footer.createDiv();
    }
    
    const footerButtons = footer.createDiv({ cls: 'payload-footer-buttons' });

    // Edit Button
    const editBtn = footerButtons.createEl('button', { cls: 'payload-btn payload-btn-edit' });
    const editIconSpan = editBtn.createSpan({ cls: 'payload-btn-icon' });
    setIcon(editIconSpan, 'pencil');
    editBtn.createSpan({ text: '编辑' });

    editBtn.addEventListener('click', () => {
        const info = ctx.getSectionInfo(el);
        if (!info) {
            new Notice('无法获取代码块位置，请确保在编辑模式下操作');
            return;
        }
        const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (file instanceof TFile) {
            new PayloadModal(app, settings, undefined, data, file, info.lineStart, info.lineEnd).open();
        } else {
            new Notice('无法定位当前文件');
        }
    });

    if (data.syntaxes.length > 0) {
        const parseBtn = footerButtons.createEl('button', { cls: 'payload-btn payload-btn-parse' });
        const iconSpan = parseBtn.createSpan({ cls: 'payload-btn-icon' });
        setIcon(iconSpan, 'book-open');
        const textSpan = parseBtn.createSpan({ text: '语法解析' });

        parseBtn.addEventListener('click', () => {
            if (syntaxesArea) {
                const isHidden = syntaxesArea.style.display === 'none';
                syntaxesArea.style.display = isHidden ? 'flex' : 'none';
                textSpan.innerText = isHidden ? '收起解析' : '语法解析';
            }
        });
    }

    // Copy Dropdown
    const copyDropdown = footerButtons.createDiv({ cls: 'payload-copy-dropdown' });
    const copyBtn = copyDropdown.createEl('button', { cls: 'payload-btn payload-btn-copy' });
    const copyIconSpan = copyBtn.createSpan({ cls: 'payload-btn-icon' });
    setIcon(copyIconSpan, 'copy');
    copyBtn.createSpan({ text: '复制' });

    const copyMenu = copyDropdown.createDiv({ cls: 'payload-copy-menu' });

    // Option 1: Copy Code (with variable replacement)
    const copyCodeItem = copyMenu.createDiv({ cls: 'payload-copy-item' });
    setIcon(copyCodeItem.createSpan({ cls: 'payload-copy-item-icon' }), 'code');
    copyCodeItem.createSpan({ text: '复制代码' });
    copyCodeItem.addEventListener('click', async () => {
        try {
            let finalCode = data.code;
            if (settings.globalVariablesList && settings.globalVariablesList.length > 0) {
                settings.globalVariablesList.forEach(variable => {
                    const key = variable.key.trim();
                    const val = variable.value;
                    if (key) {
                        const searchKey = key.startsWith('{{') && key.endsWith('}}') ? key : `{{${key}}}`;
                        const escapedKey = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedKey, 'g');
                        finalCode = finalCode.replace(regex, val);
                    }
                });
            }
            await navigator.clipboard.writeText(finalCode);
            new Notice('代码已复制（变量已替换）');
        } catch (err) {
            new Notice('代码复制失败');
        }
    });

    // Option 2: Copy Full Card (no replacement)
    const copyCardItem = copyMenu.createDiv({ cls: 'payload-copy-item' });
    setIcon(copyCardItem.createSpan({ cls: 'payload-copy-item-icon' }), 'layout');
    copyCardItem.createSpan({ text: '复制卡片' });
    copyCardItem.addEventListener('click', async () => {
        try {
            let copyContent = `\`\`\`payload\n${source.trimEnd()}\n\`\`\``;
            await navigator.clipboard.writeText(copyContent);
            new Notice('完整卡片已复制');
        } catch (err) {
            new Notice('卡片复制失败');
        }
    });
}