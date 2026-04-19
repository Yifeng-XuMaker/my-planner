<script setup>
import { ref, computed, onMounted } from 'vue'
import TodoItem from './components/TodoItem.vue'
import { db } from './firebase'
import { collection, addDoc } from "firebase/firestore"

// ======================
//  狀態管理
// ======================
const data = ref({})
const weekly = ref({})

/* 輸入變數 */
const newMonth = ref('')      
const newTodo = ref('')
const newTodoTime = ref('') 
const newMonthTodo = ref('')  
const newWeek = ref('')       
const newWeekTodo = ref('')   

/*  財務預算 */
const newBudgetName = ref('')
const newBudgetLimit = ref('')
const spendInputs = ref({}) 

/* 當前選擇狀態 */
const currentMonth = ref('')
const currentDay = ref(String(new Date().getDate()))
const currentWeek = ref('')

/*  拖曳狀態 */
const dragging = ref(null)
const dragOverDay = ref(null)

// ======================
//  儲存與核心邏輯
// ======================
function save() {
  localStorage.setItem('todoData', JSON.stringify(data.value))
  data.value = { ...data.value }
}
function saveWeekly() {
  localStorage.setItem('weeklyData', JSON.stringify(weekly.value))
  weekly.value = { ...weekly.value }
}

function ensure() {
  if (!currentMonth.value) return false
  if (!data.value[currentMonth.value]) {
    data.value[currentMonth.value] = { monthly: [], budget: [] }
  }
  return true
}

// ======================
//  通知系統
// ======================
function requestPermission() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission()
  }
}

function startTimer() {
  setInterval(() => {
    const now = new Date()
    const HHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = String(now.getDate())
    const tasks = data.value[currentMonth.value]?.[today] || []
    tasks.forEach(task => {
      if (task.time === HHmm && !task.notified && !task.done) {
        new Notification("任務提醒 🔔", { body: task.text })
        task.notified = true
        save()
      }
    })
  }, 60000)
}

// ======================
//  備份功能
// ======================
function exportData() {
  const combinedData = { todoData: data.value, weeklyData: weekly.value }
  const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `planner_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click()
}

function importData(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result)
      if (imported.todoData) {
        if (confirm("匯入將覆蓋現有資料，確定嗎？")) {
          data.value = imported.todoData; weekly.value = imported.weeklyData || {}
          save(); saveWeekly(); location.reload()
        }
      }
    } catch (err) { alert("讀取錯誤") }
  }
  reader.readAsText(file)
}

// ======================
//  增刪邏輯
// ======================
function addMonth() {
  const m = newMonth.value.trim(); if (!m) return
  if (!data.value[m]) data.value[m] = { monthly: [], budget: [] }
  currentMonth.value = m; newMonth.value = ''; save()
}

function deleteMonth(m) {
  if (!confirm(`確定要刪除 ${m} 嗎？`)) return
  delete data.value[m]
  if (currentMonth.value === m) currentMonth.value = Object.keys(data.value)[0] || ''
  save()
}

function addWeek() {
  const w = newWeek.value.trim(); if (!w) return
  if (!weekly.value[w]) weekly.value[w] = []
  currentWeek.value = w; newWeek.value = ''; saveWeekly()
}

function deleteWeek(w) {
  if (!confirm(`確定要刪除週次「${w}」嗎？`)) return
  delete weekly.value[w]
  if (currentWeek.value === w) currentWeek.value = Object.keys(weekly.value)[0] || ''
  saveWeekly()
}

function addWeekTodo() {
  if (!newWeekTodo.value.trim() || !currentWeek.value) return
  weekly.value[currentWeek.value].push({ text: newWeekTodo.value, done: false })
  newWeekTodo.value = ''; saveWeekly()
}


async function addTodo() {
  if (!newTodo.value.trim() || !ensure()) return

  const todo = {
    text: newTodo.value,
    time: newTodoTime.value,
    done: false,
    notified: false,
    day: currentDay.value,
    month: currentMonth.value,
    createdAt: Date.now() // 建議加（之後排序用）
  }

  //  本地資料
  if (!data.value[currentMonth.value][currentDay.value]) {
    data.value[currentMonth.value][currentDay.value] = []
  }

  data.value[currentMonth.value][currentDay.value].push(todo)

  //  Firebase 同步（新增）
  try {
    await addDoc(collection(db, "todos"), todo)
  } catch (e) {
    console.error("Firebase error:", e)
  }

  newTodo.value = ''
  newTodoTime.value = ''
  save()
}

function addMonthTodo() {
  if (!newMonthTodo.value.trim() || !ensure()) return
  data.value[currentMonth.value].monthly.push({ text: newMonthTodo.value, done: false })
  newMonthTodo.value = ''; save()
}

// ======================
//  拖曳邏輯
// ======================
function onDragStart(day, index) { dragging.value = { day, index } }
function onDragOver(e, day) { e.preventDefault(); dragOverDay.value = day }
function onDrop(targetDay) {
  if (!dragging.value) return
  const { day, index } = dragging.value
  const item = data.value[currentMonth.value][day][index]
  data.value[currentMonth.value][day].splice(index, 1)
  if (!data.value[currentMonth.value][targetDay]) data.value[currentMonth.value][targetDay] = []
  data.value[currentMonth.value][targetDay].push(item)
  dragging.value = null; dragOverDay.value = null; save()
}

// ======================
// 財務系統
// ======================
function addBudget() {
  if (!newBudgetName.value || !newBudgetLimit.value || !ensure()) return
  data.value[currentMonth.value].budget.push({ name: newBudgetName.value, limit: Number(newBudgetLimit.value), spent: 0 })
  newBudgetName.value = ''; newBudgetLimit.value = ''; save()
}

function addSpend(index) {
  const val = spendInputs.value[index]; const amount = Number(val)
  if (!val || isNaN(amount) || amount <= 0) return
  data.value[currentMonth.value].budget[index].spent += amount
  spendInputs.value[index] = ''; save()
}

const budgetList = computed(() => data.value[currentMonth.value]?.budget || [])
const totalBudget = computed(() => budgetList.value.reduce((sum, b) => sum + b.limit, 0))
const totalSpent = computed(() => budgetList.value.reduce((sum, b) => sum + b.spent, 0))
const totalRemaining = computed(() => totalBudget.value - totalSpent.value)
const totalPercent = computed(() => totalBudget.value ? (Math.min(totalSpent.value / totalBudget.value * 100, 100)) : 0)

function getDayStatus(day) {
  const list = data.value[currentMonth.value]?.[day]
  return (list && list.length > 0 && list.some(t => !t.done)) ? 'warning' : 'empty'
}

onMounted(() => {
  const saved = localStorage.getItem('todoData'); if (saved) data.value = JSON.parse(saved)
  const w = localStorage.getItem('weeklyData'); if (w) weekly.value = JSON.parse(w)
  currentMonth.value = Object.keys(data.value)[0] || ''
  requestPermission(); startTimer()
})
</script>

<template>
  <div class="container">
    <header class="header box">
      <div class="header-top">
        <h1>Planner Dashboard </h1>
        <div class="backup-tools">
          <button class="btn-sub" @click="exportData"> 備份</button>
          <label class="btn-sub"> 匯入<input type="file" @change="importData" accept=".json" style="display: none;"></label>
        </div>
      </div>
      <div class="input-group">
        <input v-model="newMonth" @keyup.enter="addMonth" placeholder="新增月份 (如 2024-01)" />
        <button class="btn-main" @click="addMonth">新增月份</button>
      </div>
      <div class="month-tabs">
        <div v-for="(_, m) in data" :key="m" class="tab" :class="{active: currentMonth === m}">
          <span @click="currentMonth = m">{{ m }}</span>
          <button class="del-x" @click.stop="deleteMonth(m)">✕</button>
        </div>
      </div>
    </header>

    <div v-if="currentMonth" class="layout">
      <section class="panel">
        <h3>Weekly Plan</h3>
        <div class="input-group">
          <input v-model="newWeek" placeholder="新週標題"><button @click="addWeek">+</button>
        </div>
        <div class="chips">
          <div v-for="(_, w) in weekly" :key="w" class="chip-item" :class="{active: currentWeek === w}">
            <span @click="currentWeek = w">{{ w }}</span>
            <button class="del-mini" @click.stop="deleteWeek(w)">✕</button>
          </div>
        </div>
        <div v-if="currentWeek">
          <div class="input-group">
            <input v-model="newWeekTodo" @keyup.enter="addWeekTodo" placeholder="新增任務"><button @click="addWeekTodo">+</button>
          </div>
          <ul class="todo-list">
            <TodoItem v-for="(t, i) in weekly[currentWeek]" :key="i" :todo="t" :index="i" @remove="weekly[currentWeek].splice(i,1); saveWeekly()" @toggle="saveWeekly" />
          </ul>
        </div>
      </section>

      <section class="panel main-panel">
        <h3>{{ currentMonth }} / {{ currentDay }} 日</h3>
        <div class="calendar-grid">
          <button 
            v-for="d in 31" :key="d" 
            @click="currentDay = String(d)" 
            @dragover="onDragOver($event, String(d))"
            @dragleave="dragOverDay = null"
            @drop="onDrop(String(d))"
            :class="[getDayStatus(String(d)), { active: currentDay === String(d), dragover: dragOverDay === String(d) }]"
          >
            {{ d }}
          </button>
        </div>
        <div class="input-group task-entry">
          <input v-model="newTodo" @keyup.enter="addTodo" placeholder="新增計畫">
          <input v-model="newTodoTime" type="time" class="time-picker">
          <button class="btn-main" @click="addTodo">新增</button>
        </div>
        <ul class="todo-list">
          <li v-for="(todo, index) in (data[currentMonth]?.[currentDay] || [])" :key="index" class="todo-row">
            <TodoItem :todo="todo" :index="index" @dragstart="onDragStart(currentDay, index)" @remove="data[currentMonth][currentDay].splice(index,1); save()" @toggle="save" />
            <span v-if="todo.time" class="time-tag">⏰ {{ todo.time }}</span>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>Monthly Plan</h3>
        <div class="input-group"><input v-model="newMonthTodo" @keyup.enter="addMonthTodo" placeholder="月度目標"><button @click="addMonthTodo">+</button></div>
        <ul class="todo-list">
          <TodoItem v-for="(t, i) in data[currentMonth]?.monthly" :key="i" :todo="t" :index="i" @remove="data[currentMonth].monthly.splice(i,1); save()" @toggle="save" />
        </ul>
        <hr class="divider">
        <div class="budget-section">
          <h3>Financial Management</h3>
          <div class="total-card">
            <div class="total-info">
              <div class="remaining-box">
                剩餘：<strong :class="{ over: totalRemaining < 0 }">${{ totalRemaining }}</strong>
              </div>
              <div class="usage-box">
                {{ totalSpent }} / ${{ totalBudget }}
              </div>
            </div>
            <div class="progress-container main"><div class="progress-bar filled" :style="{ width: totalPercent + '%' }"></div></div>
          </div>
          <div class="budget-input-box">
            <input v-model="newBudgetName" placeholder="項目"><input v-model="newBudgetLimit" type="number" placeholder="預算"><button class="btn-main" @click="addBudget">新增</button>
          </div>
          <div class="budget-list">
            <div v-for="(b, i) in budgetList" :key="i" class="budget-card">
              <div class="card-header">
                <span class="b-name">{{ b.name }}</span>
                <span class="b-amount">${{ b.spent }} / ${{ b.limit }}</span>
              </div>
              <div class="progress-container mini"><div class="progress-bar" :class="{ danger: (b.spent/b.limit) > 0.9 }" :style="{ width: (Math.min(b.spent/b.limit*100, 100)) + '%' }"></div></div>
              <div class="card-actions">
                <div class="spend-input"><input v-model="spendInputs[i]" type="number" placeholder="金額"><button @click="addSpend(i)">記帳</button></div>
                <button class="btn-del" @click="data[currentMonth].budget.splice(i,1); save()">✕</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
:root { --bg: #ffffff; --text: #1a1a1a; --border: #e5e7eb; --panel: #ffffff; --btn: #1a1a1a; --btn-text: #fff; --sub: #f9fafb; --accent: #6366f1; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --text: #f3f4f6; --border: #374151; --panel: #1e1e1e; --btn: #f3f4f6; --btn-text: #1a1a1a; --sub: #2d2d2d; --accent: #818cf8; } }

.container { min-height: 100vh; background: var(--bg); color: var(--text); padding: 20px; font-family: sans-serif; }
.box { border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
.header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.layout { display: flex; gap: 20px; align-items: flex-start; }
.panel { flex: 1; background: var(--panel); border: 1px solid var(--border); padding: 20px; border-radius: 12px; }
.main-panel { flex: 1.5; }

/*  總額資訊排版 */
.total-card { 
  background: var(--sub); 
  padding: 18px; 
  border-radius: 12px; 
  margin-bottom: 20px; 
  border: 1px solid var(--border); 
}
.total-info { 
  display: flex; 
  flex-direction: column; /* 強制換行排列 */
  gap: 8px; 
  margin-bottom: 12px; 
  font-size: 14px; 
}
.remaining-box {
  font-size: 1.1rem;
}
.remaining-box strong {
  font-size: 1.4rem;
  font-family: monospace;
}
.usage-box {
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.8;
  font-family: monospace;
}

/* 財務小卡 */
.card-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  gap: 15px; 
  margin-bottom: 8px; 
  font-size: 14px; 
  font-weight: bold; 
}
.b-name { 
  flex: 1; 
  text-align: left; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
}
.b-amount { 
  flex-shrink: 0; 
  font-family: monospace; 
  color: var(--accent); 
}

/* 提醒與任務樣式 */
.task-entry { gap: 4px; }
.time-picker { width: 100px; flex: none; padding: 5px; border-radius: 8px; border: 1px solid var(--border); background: var(--sub); color: var(--text); }
.todo-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
.time-tag { font-size: 11px; color: var(--accent); background: var(--sub); padding: 2px 6px; border-radius: 4px; font-weight: bold; flex-shrink: 0; }

/* 其他通用樣式 */
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 15px 0; }
.calendar-grid button { aspect-ratio: 1; border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 8px; cursor: pointer; font-weight: bold; }
.calendar-grid button.active { outline: 3px solid var(--btn); outline-offset: -3px; }
.warning { background: #facc15 !important; color: #000 !important; }
.btn-sub { background: var(--sub); color: var(--text); border: 1px solid var(--border); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; margin-left: 5px; }
.input-group { display: flex; gap: 8px; margin-bottom: 12px; }
input { flex: 1; padding: 10px; background: var(--sub); color: var(--text); border: 1px solid var(--border); border-radius: 8px; }
.btn-main { background: var(--btn); color: var(--btn-text); border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; }
.tab { padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px; cursor: pointer; background: var(--sub); display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.tab.active { background: var(--btn); color: var(--btn-text); }
.del-x, .del-mini { background: none; border: none; color: inherit; cursor: pointer; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px; }
.chip-item { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--sub); border-radius: 20px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.chip-item.active { background: var(--btn); color: var(--btn-text); }
.progress-container { width: 100%; background: var(--border); border-radius: 10px; overflow: hidden; }
.progress-container.main { height: 12px; }
.progress-container.mini { height: 5px; margin-bottom: 12px; }
.progress-bar { height: 100%; background: #10b981; transition: 0.4s; }
.progress-bar.filled { background: var(--accent); }
.progress-bar.danger { background: #ef4444; }
.over { color: #ef4444; font-weight: bold; }
.budget-card { border: 1px solid var(--border); padding: 14px; border-radius: 10px; margin-bottom: 10px; }
.card-actions { display: flex; justify-content: space-between; align-items: center; }
.spend-input { display: flex; gap: 4px; }
.spend-input input { width: 65px; padding: 4px; font-size: 12px; }
.btn-del { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; }
.divider { margin: 25px 0; border: 0; border-top: 1px solid var(--border); }
.todo-list { list-style: none; padding: 0; }
</style>