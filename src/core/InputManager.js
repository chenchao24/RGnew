/**
 * 输入管理器
 * 支持双模式操作：
 * 1. 键盘R键 + 鼠标：按住R向鼠标方向前进，鼠标控制朝向
 * 2. 纯鼠标：角色平滑跟随鼠标位置，自动面向移动方向
 */

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.mouseOnCanvas = false;
    this.mouseMoved = false;
    this.mouseMoveTime = 0;

    // 键盘状态
    this.keys = {};

    // 鼠标按钮
    this.mouseDown = false;
    this.mouseClicked = false;
    this.rightMouseClicked = false;

    // 数字键选择（升级界面用）
    this.numberKeyPressed = 0;

    // 暂停键
    this.pausePressed = false;

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.mouseOnCanvas = true;
      this.mouseMoved = true;
      this.mouseMoveTime = performance.now();
    });

    this.canvas.addEventListener('mouseenter', () => {
      this.mouseOnCanvas = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseOnCanvas = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      } else if (e.button === 2) {
        this.rightMouseClicked = true;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
      }
    });

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!this.keys[key]) {
        this.keys[key] = true;
      }

      if (key === 'escape' || key === 'p') {
        this.pausePressed = true;
      }

      if (key === '1' || key === '2' || key === '3') {
        this.numberKeyPressed = parseInt(key);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // 防止右键菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * 判断当前是否使用R键模式
   */
  isRKeyHeld() {
    return !!this.keys['r'];
  }

  /**
   * 获取鼠标在画布上的位置
   */
  getMousePosition() {
    return { x: this.mouseX, y: this.mouseY };
  }

  /**
   * 检测是否近期有鼠标移动（用于纯鼠标模式判断）
   */
  hasRecentMouseMove(thresholdMs = 100) {
    return this.mouseMoved && (performance.now() - this.mouseMoveTime) < thresholdMs;
  }

  /**
   * 每帧末尾调用，重置一次性事件
   */
  resetFrame() {
    this.mouseClicked = false;
    this.rightMouseClicked = false;
    this.pausePressed = false;
    this.numberKeyPressed = 0;
    this.mouseMoved = false;
  }

  destroy() {
    // 清理事件监听（简化处理）
  }
}
