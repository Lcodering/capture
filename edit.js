class ScreenshotEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.textInput = document.getElementById('textInput');
        
        // 工具状态
        this.currentTool = 'select';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        // 绘图属性
        this.strokeWidth = 3;
        this.strokeColor = '#ff0000';
        this.fillColor = 'transparent';
        this.fontSize = 16;
        this.opacity = 1;
        this.fillShape = false;
        
        // 历史记录
        this.history = [];
        this.historyStep = -1;
        this.maxHistorySteps = 20;
        
        // 当前路径数据（用于自由绘制）
        this.currentPath = [];
        
        this.init();
    }

    init() {
        this.loadImageFromURL();
        this.bindEvents();
        this.updateUI();
    }

    // 从URL参数加载图片
    loadImageFromURL() {
        // 取消通过URL参数加载图片，改为监听消息接收图片数据
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'editImage' && request.image) {
                const img = new Image();
                img.onload = () => {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.ctx.drawImage(img, 0, 0);
                    this.saveState();
                    this.updateCanvasSize();
                };
                img.src = request.image;
            }
        });

        // 初始化默认画布大小
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
        this.updateCanvasSize();
    }
    

    // 绑定事件
    bindEvents() {
        // 工具按钮事件
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.target.closest('[data-tool]').dataset.tool);
            });
        });

        // 画布事件
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));

        // 触摸事件（移动端支持）
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // 属性控件事件
        document.getElementById('strokeWidth').addEventListener('input', (e) => {
            this.strokeWidth = parseInt(e.target.value);
            document.getElementById('strokeValue').textContent = this.strokeWidth;
        });

        document.getElementById('strokeColor').addEventListener('change', (e) => {
            this.strokeColor = e.target.value;
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            this.fontSize = parseInt(e.target.value);
            document.getElementById('fontSizeValue').textContent = this.fontSize;
        });

        document.getElementById('opacity').addEventListener('input', (e) => {
            this.opacity = parseFloat(e.target.value);
            document.getElementById('opacityValue').textContent = Math.round(this.opacity * 100) + '%';
        });

        document.getElementById('fillShape').addEventListener('change', (e) => {
            this.fillShape = e.target.checked;
        });

        // 操作按钮事件
        document.getElementById('undo').addEventListener('click', this.undo.bind(this));
        document.getElementById('redo').addEventListener('click', this.redo.bind(this));
        document.getElementById('copy').addEventListener('click', this.copyToClipboard.bind(this));
        document.getElementById('save').addEventListener('click', this.saveImage.bind(this));

        // 文本输入事件
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.confirmText();
            } else if (e.key === 'Escape') {
                this.cancelText();
            }
        });

        this.textInput.addEventListener('blur', this.confirmText.bind(this));

        // 键盘快捷键
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // 防止页面刷新丢失工作
        window.addEventListener('beforeunload', (e) => {
            if (this.historyStep > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // 设置当前工具
    setTool(tool) {
        this.currentTool = tool;
        
        // 更新工具按钮状态
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        
        // 更新鼠标样式
        this.updateCursor();
        
        // 更新状态栏
        this.updateCurrentToolDisplay();
        
        // 隐藏文本输入框
        this.hideTextInput();
    }

    // 更新鼠标样式
    updateCursor() {
        const cursors = {
            select: 'default',
            pen: 'crosshair',
            arrow: 'crosshair',
            rectangle: 'crosshair',
            circle: 'crosshair',
            text: 'text',
            blur: 'crosshair'
        };
        this.canvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    // 获取鼠标在画布上的坐标
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // 鼠标按下事件
    handleMouseDown(e) {
        if (this.currentTool === 'text') return;
        
        const coords = this.getCanvasCoordinates(e);
        this.startX = coords.x;
        this.startY = coords.y;
        this.currentX = coords.x;
        this.currentY = coords.y;
        this.isDrawing = true;

        if (this.currentTool === 'pen') {
            this.currentPath = [{ x: coords.x, y: coords.y }];
        }
    }

    // 鼠标移动事件
    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const coords = this.getCanvasCoordinates(e);
        this.currentX = coords.x;
        this.currentY = coords.y;

        if (this.currentTool === 'pen') {
            this.currentPath.push({ x: coords.x, y: coords.y });
            this.drawFreePath();
        } else if (this.currentTool === 'blur') {
            this.applyBlur(coords.x, coords.y);
        } else {
            this.drawPreview();
        }
    }

    // 鼠标抬起事件
    handleMouseUp(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (this.currentTool === 'pen') {
            this.finalizePath();
        } else if (this.currentTool !== 'blur') {
            this.finalizeShape();
        }
        
        this.saveState();
    }

    // 画布点击事件（用于文本工具）
    handleCanvasClick(e) {
        if (this.currentTool === 'text') {
            const coords = this.getCanvasCoordinates(e);
            this.showTextInput(coords.x, coords.y);
        }
    }

    // 触摸事件处理
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.canvas.dispatchEvent(mouseEvent);
    }

    // 绘制自由路径
    drawFreePath() {
        if (this.currentPath.length < 2) return;
        
        this.redrawCanvas();
        
        this.ctx.save();
        this.ctx.globalAlpha = this.opacity;
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        
        for (let i = 1; i < this.currentPath.length; i++) {
            this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }

    // 绘制预览
    drawPreview() {
        this.redrawCanvas();
        
        this.ctx.save();
        this.ctx.globalAlpha = this.opacity;
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        
        if (this.fillShape) {
            this.ctx.fillStyle = this.strokeColor;
        }

        switch (this.currentTool) {
            case 'rectangle':
                this.drawRectangle(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
                break;
            case 'circle':
                this.drawCircle(this.startX, this.startY, this.currentX, this.currentY);
                break;
            case 'arrow':
                this.drawArrow(this.startX, this.startY, this.currentX, this.currentY);
                break;
        }
        
        this.ctx.restore();
    }

    // 绘制矩形
    drawRectangle(x, y, width, height) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        
        if (this.fillShape) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

        // 绘制圆形
    drawCircle(startX, startY, endX, endY) {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2;
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        
        if (this.fillShape) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    // 绘制箭头
    drawArrow(startX, startY, endX, endY) {
        const headLength = 15;
        const angle = Math.atan2(endY - startY, endX - startX);
        
        // 绘制箭头主线
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // 绘制箭头头部
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    // 应用模糊效果
    applyBlur(x, y) {
        const radius = this.strokeWidth * 2;
        const imageData = this.ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2);
        
        // 简单的马赛克效果
        const blockSize = Math.max(2, Math.floor(this.strokeWidth / 2));
        this.applyMosaicEffect(imageData, blockSize);
        
        this.ctx.putImageData(imageData, x - radius, y - radius);
    }

    // 马赛克效果
    applyMosaicEffect(imageData, blockSize) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;
                
                // 计算块内像素的平均值
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count++;
                    }
                }
                
                // 应用平均值到整个块
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                a = Math.floor(a / count);
                
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        data[index] = r;
                        data[index + 1] = g;
                        data[index + 2] = b;
                        data[index + 3] = a;
                    }
                }
            }
        }
    }

    // 完成路径绘制
    finalizePath() {
        // 路径已经在 drawFreePath 中绘制，这里不需要额外操作
    }

    // 完成形状绘制
    finalizeShape() {
        this.ctx.save();
        this.ctx.globalAlpha = this.opacity;
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        
        if (this.fillShape) {
            this.ctx.fillStyle = this.strokeColor;
        }

        switch (this.currentTool) {
            case 'rectangle':
                this.drawRectangle(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
                break;
            case 'circle':
                this.drawCircle(this.startX, this.startY, this.currentX, this.currentY);
                break;
            case 'arrow':
                this.drawArrow(this.startX, this.startY, this.currentX, this.currentY);
                break;
        }
        
        this.ctx.restore();
    }

    // 显示文本输入框
    showTextInput(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        
        this.textInput.style.display = 'block';
        this.textInput.style.left = (rect.left + x * scaleX) + 'px';
        this.textInput.style.top = (rect.top + y * scaleY) + 'px';
        this.textInput.style.fontSize = this.fontSize + 'px';
        this.textInput.style.color = this.strokeColor;
        this.textInput.value = '';
        this.textInput.focus();
        
        // 保存文本位置
        this.textX = x;
        this.textY = y;
    }

    // 隐藏文本输入框
    hideTextInput() {
        this.textInput.style.display = 'none';
    }

    // 确认文本输入
    confirmText() {
        const text = this.textInput.value.trim();
        if (text) {
            this.ctx.save();
            this.ctx.globalAlpha = this.opacity;
            this.ctx.fillStyle = this.strokeColor;
            this.ctx.font = `${this.fontSize}px Arial, sans-serif`;
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(text, this.textX, this.textY);
            this.ctx.restore();
            
            this.saveState();
        }
        this.hideTextInput();
    }

    // 取消文本输入
    cancelText() {
        this.hideTextInput();
    }

    // 重绘画布
    redrawCanvas() {
        if (this.historyStep >= 0) {
            const imageData = this.history[this.historyStep];
            this.ctx.putImageData(imageData, 0, 0);
        }
    }

    // 保存状态
    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistorySteps) {
            this.history.shift();
            this.historyStep--;
        }
        
        this.updateUndoRedoButtons();
    }

    // 撤销操作
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            const imageData = this.history[this.historyStep];
            this.ctx.putImageData(imageData, 0, 0);
            this.updateUndoRedoButtons();
        }
    }

    // 重做操作
    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            const imageData = this.history[this.historyStep];
            this.ctx.putImageData(imageData, 0, 0);
            this.updateUndoRedoButtons();
        }
    }

    // 更新撤销重做按钮状态
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        
        undoBtn.disabled = this.historyStep <= 0;
        redoBtn.disabled = this.historyStep >= this.history.length - 1;
        
        undoBtn.classList.toggle('disabled', undoBtn.disabled);
        redoBtn.classList.toggle('disabled', redoBtn.disabled);
    }

    // 复制到剪贴板
    async copyToClipboard() {
        try {
            const blob = await this.canvasToBlob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            this.showMessage('图片已复制到剪贴板');
        } catch (err) {
            console.error('复制失败:', err);
            this.showMessage('复制失败，请手动右键保存图片');
        }
    }

    // 保存图片
    saveImage() {
        const link = document.createElement('a');
        link.download = `screenshot_${Date.now()}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
        this.showMessage('图片已保存');
    }

    // Canvas转Blob
    canvasToBlob() {
        return new Promise(resolve => {
            this.canvas.toBlob(resolve, 'image/png');
        });
    }

    // 显示消息
    showMessage(message) {
        // 创建临时消息提示
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        
        // 显示动画
        setTimeout(() => messageEl.style.opacity = '1', 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageEl.style.opacity = '0';
            setTimeout(() => messageEl.remove(), 300);
        }, 2000);
    }

    // 键盘快捷键处理
    handleKeydown(e) {
        if (e.target === this.textInput) return;
        
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copyToClipboard();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveImage();
                    break;
            }
        }
        
        // 工具快捷键
        switch (e.key) {
            case '1':
                this.setTool('select');
                break;
            case '2':
                this.setTool('pen');
                break;
            case '3':
                this.setTool('arrow');
                break;
            case '4':
                this.setTool('rectangle');
                break;
            case '5':
                this.setTool('circle');
                break;
            case '6':
                this.setTool('text');
                break;
            case '7':
                this.setTool('blur');
                break;
            case 'Escape':
                this.setTool('select');
                break;
        }
    }

    // 更新UI状态
    updateUI() {
        this.updateCanvasSize();
        this.updateCurrentToolDisplay();
        this.updateUndoRedoButtons();
    }

    // 更新画布尺寸显示
    updateCanvasSize() {
        document.getElementById('canvasSize').textContent = 
            `画布: ${this.canvas.width} × ${this.canvas.height}`;
    }

    // 更新当前工具显示
    updateCurrentToolDisplay() {
        const toolNames = {
            select: '选择',
            pen: '画笔',
            arrow: '箭头',
            rectangle: '矩形',
            circle: '圆形',
            text: '文字',
            blur: '模糊'
        };
        
        document.getElementById('currentTool').textContent = 
            `当前工具: ${toolNames[this.currentTool] || this.currentTool}`;
    }
}

// 初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
    new ScreenshotEditor();
});

// 防止默认的拖拽行为
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());
