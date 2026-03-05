const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { auth, getUserDir } = require('./auth');

function getAcademic(email) {
  const f = path.join(getUserDir(email), 'academic.json');
  return fs.readJsonSync(f, { throws: false }) || { courses: [], calendar: [] };
}
function getTodos(email) {
  const f = path.join(getUserDir(email), 'todos.json');
  return fs.readJsonSync(f, { throws: false }) || [];
}
function getReminders(email) {
  const f = path.join(getUserDir(email), 'reminders.json');
  return fs.readJsonSync(f, { throws: false }) || [];
}
function getDayPlans(email) {
  const f = path.join(getUserDir(email), 'dayplans.json');
  return fs.readJsonSync(f, { throws: false }) || {};
}

router.post('/chat', auth, (req, res) => {
  const { message } = req.body;
  const email = req.user.email;
  const name = req.user.name;

  const msg = message.toLowerCase().trim();
  const academic = getAcademic(email);
  const todos = getTodos(email);
  const reminders = getReminders(email);
  const today = new Date().toISOString().split('T')[0];
  const todayTodos = todos.filter(t => t.date === today);
  const pendingTodos = todayTodos.filter(t => !t.completed);
  const upcomingReminders = reminders.filter(r => {
    if (r.dismissed) return false;
    const d = new Date(r.datetime);
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d >= now && d <= week;
  });

  let reply = '';

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    reply = `Hello ${name}! 👋 I'm your StudentLife OS assistant. I can help you with your tasks, grades, reminders, and academic progress. What would you like to know?`;
  } else if (msg.includes('todo') || msg.includes('task') || msg.includes('pending')) {
    if (pendingTodos.length === 0) {
      reply = `Great work ${name}! 🎉 You have no pending tasks for today. All done!`;
    } else {
      const list = pendingTodos.slice(0, 5).map((t, i) => `${i + 1}. ${t.text} (${t.priority} priority)`).join('\n');
      reply = `You have ${pendingTodos.length} pending task(s) for today:\n${list}`;
    }
  } else if (msg.includes('grade') || msg.includes('score') || msg.includes('result') || msg.includes('mark')) {
    if (academic.courses.length === 0) {
      reply = `You haven't added any courses yet. Go to the Academics section to add your courses and track grades!`;
    } else {
      const summary = academic.courses.map(c => {
        const assessments = c.assessments || [];
        if (!assessments.length) return `${c.name}: No scores yet`;
        const avg = (assessments.reduce((s, a) => s + parseFloat(a.percentage), 0) / assessments.length).toFixed(1);
        const last = assessments[assessments.length - 1];
        return `${c.name}: Avg ${avg}% | Last: ${last.title} → ${last.percentage}%`;
      }).join('\n');
      reply = `📊 Your academic summary:\n${summary}`;
    }
  } else if (msg.includes('remind') || msg.includes('upcoming') || msg.includes('event') || msg.includes('exam')) {
    if (upcomingReminders.length === 0) {
      reply = `No upcoming reminders in the next 7 days. Set some reminders for your exams and assignments!`;
    } else {
      const list = upcomingReminders.slice(0, 5).map(r => {
        const d = new Date(r.datetime);
        return `• ${r.title} – ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }).join('\n');
      reply = `⏰ Upcoming reminders (next 7 days):\n${list}`;
    }
  } else if (msg.includes('course') || msg.includes('subject')) {
    if (academic.courses.length === 0) {
      reply = `You haven't added any courses yet. Head to the Academics tab to get started!`;
    } else {
      const list = academic.courses.map(c => `• ${c.code} – ${c.name}`).join('\n');
      reply = `📚 Your enrolled courses:\n${list}`;
    }
  } else if (msg.includes('progress') || msg.includes('improve') || msg.includes('performance')) {
    if (academic.courses.length === 0) {
      reply = `Start by adding your courses and entering assessment scores to see your progress charts!`;
    } else {
      const improving = [], declining = [];
      academic.courses.forEach(c => {
        const a = c.assessments || [];
        if (a.length >= 2) {
          const recent = parseFloat(a[a.length - 1].percentage);
          const prior = parseFloat(a[a.length - 2].percentage);
          if (recent > prior) improving.push(c.name);
          else if (recent < prior) declining.push(c.name);
        }
      });
      let r = '📈 Performance analysis:\n';
      if (improving.length) r += `Improving: ${improving.join(', ')}\n`;
      if (declining.length) r += `Needs attention: ${declining.join(', ')}\n`;
      if (!improving.length && !declining.length) r += 'Not enough data yet – keep adding your scores!';
      reply = r;
    }
  } else if (msg.includes('plan') || msg.includes('today') || msg.includes('schedule')) {
    const plan = getDayPlans(email)[today];
    if (!plan || !plan.tasks || plan.tasks.length === 0) {
      reply = `No day plan set for today. Use the Day Planner to set your daily goals!`;
    } else {
      const done = plan.tasks.filter(t => t.done).length;
      const list = plan.tasks.slice(0, 5).map((t, i) => `${i + 1}. [${t.done ? '✓' : ' '}] ${t.text}`).join('\n');
      reply = `📋 Today's plan (${done}/${plan.tasks.length} done):\n${list}`;
    }
  } else if (msg.includes('help') || msg.includes('what can you do') || msg.includes('commands')) {
    reply = `I can help you with:\n• 📋 "show my tasks" – today's todo list\n• 📊 "show grades" – academic scores\n• 📚 "my courses" – enrolled subjects\n• ⏰ "upcoming reminders" – next events\n• 📈 "my progress" – performance analysis\n• 📅 "today's plan" – day schedule\n• 💡 Just ask naturally – I understand you!`;
  } else if (msg.includes('good') || msg.includes('great') || msg.includes('awesome') || msg.includes('thank')) {
    reply = `You're welcome, ${name}! 😊 Keep up the great work. Remember, consistent effort leads to success!`;
  } else if (msg.includes('motivat') || msg.includes('inspire') || msg.includes('encourage')) {
    const quotes = [
      `"Success is not final, failure is not fatal: it is the courage to continue that counts." – Winston Churchill`,
      `"Education is the most powerful weapon which you can use to change the world." – Nelson Mandela`,
      `"The secret of getting ahead is getting started." – Mark Twain`,
      `"It does not matter how slowly you go as long as you do not stop." – Confucius`,
      `"Believe you can and you're halfway there." – Theodore Roosevelt`
    ];
    reply = `💪 Here's some motivation for you, ${name}:\n\n${quotes[Math.floor(Math.random() * quotes.length)]}`;
  } else if (msg.includes('gpa') || msg.includes('cgpa') || msg.includes('average')) {
    if (academic.courses.length === 0) {
      reply = `No courses added yet. Add your courses and grades to calculate your GPA!`;
    } else {
      let totalPct = 0, count = 0;
      academic.courses.forEach(c => {
        const a = c.assessments || [];
        if (a.length) {
          const avg = a.reduce((s, x) => s + parseFloat(x.percentage), 0) / a.length;
          totalPct += avg;
          count++;
        }
      });
      if (count === 0) {
        reply = `You have courses but no assessment scores yet. Start entering your grades!`;
      } else {
        const overallAvg = (totalPct / count).toFixed(2);
        let grade = overallAvg >= 90 ? 'A+' : overallAvg >= 85 ? 'A' : overallAvg >= 80 ? 'A-' :
          overallAvg >= 75 ? 'B+' : overallAvg >= 70 ? 'B' : overallAvg >= 65 ? 'B-' :
          overallAvg >= 60 ? 'C+' : overallAvg >= 55 ? 'C' : overallAvg >= 50 ? 'D' : 'F';
        reply = `🎓 Your overall average: ${overallAvg}% (Grade: ${grade})\nBased on ${count} course(s) with recorded assessments.`;
      }
    }
  } else {
    reply = `I'm not sure about that, ${name}. Try asking me about your tasks, grades, courses, reminders, or progress. Type "help" to see all I can do!`;
  }

  res.json({ reply, timestamp: new Date().toISOString() });
});

module.exports = router;
