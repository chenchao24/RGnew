/**
 * 通用对象池，用于复用频繁创建销毁的对象（弹道、伤害数字、粒子等）
 */
export class ObjectPool {
  constructor(factory, resetFn, initialSize = 0) {
    this._factory = factory;
    this._resetFn = resetFn;
    this._pool = [];
    this._active = [];

    for (let i = 0; i < initialSize; i++) {
      this._pool.push(this._factory());
    }
  }

  get(params) {
    let obj = this._pool.pop();
    if (!obj) {
      obj = this._factory();
    }
    if (this._resetFn) {
      this._resetFn(obj, params);
    }
    this._active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this._active.indexOf(obj);
    if (idx !== -1) {
      this._active.splice(idx, 1);
      this._pool.push(obj);
    }
  }

  releaseAll() {
    while (this._active.length > 0) {
      this._pool.push(this._active.pop());
    }
  }

  getActive() {
    return this._active;
  }

  get activeCount() {
    return this._active.length;
  }

  update(dt, updateFn) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const obj = this._active[i];
      const shouldRemove = updateFn(obj, dt);
      if (shouldRemove) {
        this._active.splice(i, 1);
        this._pool.push(obj);
      }
    }
  }
}
