// Panel控制逻辑
class DebugHelperPanel {
  constructor() {
    this.isPaused = false;
    this.records = {
      class: [],
      style: [],
      attribute: [],
      event: []
    };
    this.startTime = Date.now();
    this.timerInterval = null;
    this.lastSelectedElementId = null; // 添加这个变量

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupTabSwitching();
    this.startTimer();
    this.injectContentScript();
    this.setupMessageListener();
  }

  setupEventListeners() {
    // 清空按钮
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearAllRecords();
    });

    // 导出按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    // 暂停/继续按钮
    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.togglePause();
    });
  }

  setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // 更新标签状态
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 更新内容显示
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === targetTab) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);

      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      document.getElementById('runningTime').textContent = timeStr;
    }, 1000);
  }

  injectContentScript() {
    // 注入content script到当前标签页
    chrome.devtools.inspectedWindow.eval(`
      // 防止重复注入
      if (!window.__DEBUG_HELPER_INJECTED__) {
        window.__DEBUG_HELPER_INJECTED__ = true;
        (${contentScriptCode.toString()})();
      }
    `, (result, error) => {
      if (error) {
        console.error('Failed to inject content script:', error);
      } else {
        console.log('Content script injected successfully');
        // 注入成功后，开始监听元素选择
        this.startElementSelection();
      }
    });
  }

  startElementSelection() {
    // 使用chrome.devtools API来获取选中的元素
    // 每500ms检查一次
    setInterval(() => {
      // 通过eval在页面上下文中执行代码，传递$0（当前选中元素）
      chrome.devtools.inspectedWindow.eval(`
        (function() {
          if (!$0) return null;

          // 获取元素信息
          const element = $0;
          const selector = element.id ? '#' + element.id :
                          (element.className && typeof element.className === 'string' ?
                           element.tagName.toLowerCase() + '.' + element.className.trim().split(/\\s+/).slice(0, 3).join('.') :
                           element.tagName.toLowerCase());

          const elementId = element.__debug_helper_id__ || (element.__debug_helper_id__ = 'elem_' + Math.random().toString(36).substr(2, 9));

          // 通知content script有新元素被选中
          if (window.__DEBUG_HELPER_SELECT_ELEMENT__) {
            window.__DEBUG_HELPER_SELECT_ELEMENT__(element);
          }

          return {
            id: elementId,
            selector: selector,
            tagName: element.tagName
          };
        })();
      `, (result, error) => {
        if (error) {
          console.error('Error getting selected element:', error);
          return;
        }

        if (result && result.id) {
          // 检查是否是新选中的元素
          if (this.lastSelectedElementId !== result.id) {
            this.lastSelectedElementId = result.id;
            console.log('New element selected:', result.selector);
            document.getElementById('selectedElement').textContent = result.selector;
          }
        }
      });
    }, 500);
  }

  setupMessageListener() {
    // 使用eval监听来自content script的自定义事件
    const checkInterval = setInterval(() => {
      if (this.isPaused) return;

      chrome.devtools.inspectedWindow.eval(`
        if (window.__DEBUG_HELPER_MESSAGES__ && window.__DEBUG_HELPER_MESSAGES__.length > 0) {
          const messages = [...window.__DEBUG_HELPER_MESSAGES__];
          window.__DEBUG_HELPER_MESSAGES__ = [];
          messages;
        }
      `, (messages, error) => {
        if (error) {
          console.error('Error reading messages:', error);
          return;
        }

        if (messages && messages.length > 0) {
          console.log('Received messages:', messages.length);
          messages.forEach(message => {
            switch (message.type) {
              case 'CLASS_CHANGE':
                this.handleClassChange(message.data);
                break;
              case 'STYLE_CHANGE':
                this.handleStyleChange(message.data);
                break;
              case 'ATTRIBUTE_CHANGE':
                this.handleAttributeChange(message.data);
                break;
              case 'EVENT_LISTENERS':
                this.handleEventListeners(message.data);
                break;
              case 'ELEMENT_SELECTED':
                this.handleElementSelected(message.data);
                break;
              case 'DEBUG':
                console.log('Content script debug:', message.data);
                break;
            }
          });
        }
      });

      // 定期检查并更新选中的元素
      chrome.devtools.inspectedWindow.eval(`
        if (window.__DEBUG_HELPER_CHECK_SELECTION__) {
          window.__DEBUG_HELPER_CHECK_SELECTION__();
        }
      `);
    }, 100);
  }

  handleClassChange(data) {
    this.records.class.push({
      ...data,
      timestamp: Date.now()
    });

    this.updateClassRecords();
    this.updateCounts();
  }

  handleStyleChange(data) {
    this.records.style.push({
      ...data,
      timestamp: Date.now()
    });

    this.updateStyleRecords();
    this.updateCounts();
  }

  handleAttributeChange(data) {
    this.records.attribute.push({
      ...data,
      timestamp: Date.now()
    });

    this.updateAttributeRecords();
    this.updateCounts();
  }

  handleEventListeners(data) {
    this.records.event = data.events || [];
    this.updateEventRecords();
    this.updateCounts();
  }

  handleElementSelected(data) {
    document.getElementById('selectedElement').textContent = data.selector;
  }

  updateClassRecords() {
    const container = document.getElementById('classRecords');
    const emptyState = document.getElementById('classEmpty');

    if (this.records.class.length === 0) {
      emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    // 只显示最新的50条记录
    const recentRecords = this.records.class.slice(-50).reverse();

    container.innerHTML = recentRecords.map(record => {
      const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      let changesHtml = '';

      if (record.added && record.added.length > 0) {
        changesHtml += `
          <div class="change-item">
            <span class="change-label">新增:</span>
            <div class="class-list">
              ${record.added.map(cls => `<span class="class-tag added">${cls}</span>`).join('')}
            </div>
          </div>
        `;
      }

      if (record.removed && record.removed.length > 0) {
        changesHtml += `
          <div class="change-item">
            <span class="change-label">删除:</span>
            <div class="class-list">
              ${record.removed.map(cls => `<span class="class-tag removed">${cls}</span>`).join('')}
            </div>
          </div>
        `;
      }

      if (record.current && record.current.length > 0) {
        changesHtml += `
          <div class="change-item">
            <span class="change-label">当前:</span>
            <div class="class-list">
              ${record.current.map(cls => `<span class="class-tag">${cls}</span>`).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="record-card">
          <div class="record-header">
            <div class="record-title">
              <div class="record-element">${this.escapeHtml(record.element)}</div>
              <div class="record-time">${time}</div>
            </div>
            <span class="record-type ${record.eventType === 'mouseenter' ? 'hover-enter' : 'hover-leave'}">
              ${record.eventType === 'mouseenter' ? 'Hover 进入' : 'Hover 离开'}
            </span>
          </div>
          <div class="record-body">
            ${changesHtml}
          </div>
        </div>
      `;
    }).join('');

    // 更新性能统计
    document.getElementById('domChangeCount').textContent = this.records.class.length;
  }

  updateStyleRecords() {
    const container = document.getElementById('styleRecords');
    const emptyState = document.getElementById('styleEmpty');

    if (this.records.style.length === 0) {
      emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    const recentRecords = this.records.style.slice(-50).reverse();

    container.innerHTML = recentRecords.map(record => {
      const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      const changesHtml = Object.entries(record.changes || {}).map(([property, change]) => `
        <div class="change-item">
          <span class="change-label">${property}:</span>
          <div class="change-diff">
            <span class="diff-old">${this.escapeHtml(change.oldValue)}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-new">${this.escapeHtml(change.newValue)}</span>
          </div>
        </div>
      `).join('');

      return `
        <div class="record-card">
          <div class="record-header">
            <div class="record-title">
              <div class="record-element">${this.escapeHtml(record.element)}</div>
              <div class="record-time">${time}</div>
            </div>
            <span class="record-type modified">样式变化</span>
          </div>
          <div class="record-body">
            ${changesHtml}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('styleChangeCount').textContent = this.records.style.length;
  }

  updateAttributeRecords() {
    const container = document.getElementById('attrRecords');
    const emptyState = document.getElementById('attrEmpty');

    if (this.records.attribute.length === 0) {
      emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    const recentRecords = this.records.attribute.slice(-50).reverse();

    container.innerHTML = recentRecords.map(record => {
      const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      let typeClass = 'modified';
      let typeName = '修改';

      if (!record.oldValue) {
        typeClass = 'added';
        typeName = '新增';
      } else if (!record.newValue) {
        typeClass = 'removed';
        typeName = '删除';
      }

      return `
        <div class="record-card">
          <div class="record-header">
            <div class="record-title">
              <div class="record-element">${this.escapeHtml(record.element)}</div>
              <div class="record-time">${time}</div>
            </div>
            <span class="record-type ${typeClass}">${typeName}</span>
          </div>
          <div class="record-body">
            <div class="change-item">
              <span class="change-label">${record.attributeName}:</span>
              ${record.oldValue && record.newValue ? `
                <div class="change-diff">
                  <span class="diff-old">${this.escapeHtml(record.oldValue)}</span>
                  <span class="diff-arrow">→</span>
                  <span class="diff-new">${this.escapeHtml(record.newValue)}</span>
                </div>
              ` : `
                <span class="change-value">${this.escapeHtml(record.newValue || record.oldValue)}</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updateEventRecords() {
    const container = document.getElementById('eventRecords');
    const emptyState = document.getElementById('eventEmpty');

    if (this.records.event.length === 0) {
      emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    // 按事件类型分组
    const eventGroups = {};
    this.records.event.forEach(event => {
      if (!eventGroups[event.element]) {
        eventGroups[event.element] = {};
      }
      eventGroups[event.element][event.type] = (eventGroups[event.element][event.type] || 0) + 1;
    });

    container.innerHTML = Object.entries(eventGroups).map(([element, events]) => `
      <div class="record-card">
        <div class="record-header">
          <div class="record-title">
            <div class="record-element">${this.escapeHtml(element)}</div>
          </div>
        </div>
        <div class="record-body">
          <div class="event-list">
            ${Object.entries(events).map(([type, count]) => `
              <div class="event-item">
                <span class="event-name">${type}</span>
                <span class="event-count">${count} 个监听器</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }

  updateCounts() {
    document.getElementById('classCount').textContent = this.records.class.length;
    document.getElementById('styleCount').textContent = this.records.style.length;
    document.getElementById('attrCount').textContent = this.records.attribute.length;
    document.getElementById('eventCount').textContent = this.records.event.length;

    const total = this.records.class.length + this.records.style.length +
                  this.records.attribute.length + this.records.event.length;
    document.getElementById('totalRecords').textContent = total;
  }

  clearAllRecords() {
    if (!confirm('确定要清空所有记录吗？')) {
      return;
    }

    this.records = {
      class: [],
      style: [],
      attribute: [],
      event: []
    };

    this.updateClassRecords();
    this.updateStyleRecords();
    this.updateAttributeRecords();
    this.updateEventRecords();
    this.updateCounts();

    // 重置统计
    document.getElementById('domChangeCount').textContent = '0';
    document.getElementById('styleChangeCount').textContent = '0';
  }

  togglePause() {
    this.isPaused = !this.isPaused;

    const btn = document.getElementById('pauseBtn');
    const btnText = document.getElementById('pauseBtnText');
    const status = document.getElementById('monitorStatus');

    if (this.isPaused) {
      btnText.textContent = '继续';
      status.textContent = '已暂停';
      status.className = 'status-value status-paused';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span id="pauseBtnText">继续</span>
      `;
    } else {
      btnText.textContent = '暂停';
      status.textContent = '运行中';
      status.className = 'status-value status-active';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        <span id="pauseBtnText">暂停</span>
      `;
    }
  }

  exportData() {
    const data = {
      exportTime: new Date().toISOString(),
      records: this.records,
      summary: {
        totalRecords: this.records.class.length + this.records.style.length +
                     this.records.attribute.length + this.records.event.length,
        classChanges: this.records.class.length,
        styleChanges: this.records.style.length,
        attributeChanges: this.records.attribute.length,
        eventListeners: this.records.event.length
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-helper-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Content Script代码 (将被注入到页面中)
function contentScriptCode() {
  console.log('Frontend Debug Helper content script loaded');

  // 消息队列
  window.__DEBUG_HELPER_MESSAGES__ = window.__DEBUG_HELPER_MESSAGES__ || [];

  // 发送消息到panel
  function sendMessage(type, data) {
    window.__DEBUG_HELPER_MESSAGES__.push({ type, data });
  }

  // 获取元素选择器
  function getElementSelector(element) {
    if (!element) return 'unknown';

    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();

    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 3).join('.');
      }
    }

    return selector;
  }

  // 存储每个元素的class状态
  const elementClassMap = new WeakMap();

  // 监听Elements面板选中的元素
  let selectedElement = null;
  let lastInspectedElementId = null;

  // 为元素生成唯一ID
  function getElementId(element) {
    if (!element) return null;
    if (!element.__debug_helper_id__) {
      element.__debug_helper_id__ = 'elem_' + Math.random().toString(36).substr(2, 9);
    }
    return element.__debug_helper_id__;
  }

  // 暴露函数供panel调用，用于设置当前监控的元素
  window.__DEBUG_HELPER_SELECT_ELEMENT__ = function(element) {
    if (!element) return;

    const elementId = getElementId(element);

    // 如果是新元素，设置监控
    if (elementId !== lastInspectedElementId) {
      lastInspectedElementId = elementId;
      selectedElement = element;

      console.log('New element selected in content script:', getElementSelector(element));

      setupElementMonitoring(selectedElement);

      sendMessage('ELEMENT_SELECTED', {
        selector: getElementSelector(selectedElement)
      });

      // 获取元素的事件监听器
      captureEventListeners(selectedElement);
    }
  };

  sendMessage('DEBUG', { message: 'Content script initialized, waiting for element selection...' });

  // 设置元素监控
  function setupElementMonitoring(element) {
    if (!element) return;

    // 初始化class状态
    const initialClasses = element.className && typeof element.className === 'string'
      ? Array.from(element.classList)
      : [];
    elementClassMap.set(element, initialClasses);

    // 移除旧的监听器
    element.removeEventListener('mouseenter', handleMouseEnter);
    element.removeEventListener('mouseleave', handleMouseLeave);

    // 添加新的监听器
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    console.log('Monitoring element:', getElementSelector(element));
  }

  // 处理鼠标进入
  function handleMouseEnter(event) {
    const element = event.currentTarget;
    const oldClasses = elementClassMap.get(element) || [];

    console.log('Mouse entered element:', getElementSelector(element));
    console.log('Old classes:', oldClasses);

    // 短暂延迟后获取新的class列表，确保捕获到动态添加的class
    setTimeout(() => {
      const newClasses = element.className && typeof element.className === 'string'
        ? Array.from(element.classList)
        : [];

      console.log('New classes:', newClasses);

      const added = newClasses.filter(c => !oldClasses.includes(c));
      const removed = oldClasses.filter(c => !newClasses.includes(c));

      console.log('Added:', added, 'Removed:', removed);

      // 总是发送消息，即使没有变化（用于调试）
      sendMessage('CLASS_CHANGE', {
        element: getElementSelector(element),
        eventType: 'mouseenter',
        added: added,
        removed: removed,
        current: newClasses
      });

      // 同时捕获样式变化
      captureStyleChanges(element, 'mouseenter');

      elementClassMap.set(element, newClasses);
    }, 50);
  }

  // 处理鼠标离开
  function handleMouseLeave(event) {
    const element = event.currentTarget;
    const oldClasses = elementClassMap.get(element) || [];

    console.log('Mouse left element:', getElementSelector(element));

    setTimeout(() => {
      const newClasses = element.className && typeof element.className === 'string'
        ? Array.from(element.classList)
        : [];

      const added = newClasses.filter(c => !oldClasses.includes(c));
      const removed = oldClasses.filter(c => !newClasses.includes(c));

      console.log('Leave - Added:', added, 'Removed:', removed);

      // 总是发送消息
      sendMessage('CLASS_CHANGE', {
        element: getElementSelector(element),
        eventType: 'mouseleave',
        added: added,
        removed: removed,
        current: newClasses
      });

      captureStyleChanges(element, 'mouseleave');

      elementClassMap.set(element, newClasses);
    }, 50);
  }

  // 样式变化追踪
  const elementStyleMap = new WeakMap();

  function captureStyleChanges(element, eventType) {
    const computedStyle = window.getComputedStyle(element);
    const importantProps = [
      'display', 'visibility', 'opacity', 'color', 'background-color',
      'border', 'padding', 'margin', 'width', 'height',
      'transform', 'transition', 'animation'
    ];

    const currentStyles = {};
    importantProps.forEach(prop => {
      currentStyles[prop] = computedStyle.getPropertyValue(prop);
    });

    const oldStyles = elementStyleMap.get(element) || {};
    const changes = {};

    importantProps.forEach(prop => {
      if (oldStyles[prop] !== currentStyles[prop]) {
        changes[prop] = {
          oldValue: oldStyles[prop] || 'none',
          newValue: currentStyles[prop]
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      sendMessage('STYLE_CHANGE', {
        element: getElementSelector(element),
        eventType: eventType,
        changes: changes
      });
    }

    elementStyleMap.set(element, currentStyles);
  }

  // 使用MutationObserver监控所有DOM变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.target === selectedElement) {
        const attributeName = mutation.attributeName;
        const oldValue = mutation.oldValue;
        const newValue = mutation.target.getAttribute(attributeName);

        if (attributeName === 'class') {
          // class变化已经在mouseenter/mouseleave中处理
          return;
        }

        sendMessage('ATTRIBUTE_CHANGE', {
          element: getElementSelector(mutation.target),
          attributeName: attributeName,
          oldValue: oldValue,
          newValue: newValue
        });
      }
    });
  });

  // 开始观察
  observer.observe(document.body, {
    attributes: true,
    attributeOldValue: true,
    subtree: true,
    childList: true
  });

  // 捕获事件监听器
  function captureEventListeners(element) {
    if (!element) return;

    const events = [];
    const eventTypes = [
      'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
      'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
      'keydown', 'keyup', 'keypress',
      'focus', 'blur', 'change', 'input', 'submit',
      'touchstart', 'touchend', 'touchmove',
      'scroll', 'resize', 'load'
    ];

    eventTypes.forEach(type => {
      // 尝试检测是否有该事件监听器
      // 注意：这是一个简化版本，实际的事件监听器检测比较复杂
      const eventProp = 'on' + type;
      if (element[eventProp]) {
        events.push({
          element: getElementSelector(element),
          type: type
        });
      }
    });

    if (events.length > 0) {
      sendMessage('EVENT_LISTENERS', {
        events: events
      });
    }
  }

  console.log('Content script initialized');
}

// 初始化Panel
const panel = new DebugHelperPanel();
