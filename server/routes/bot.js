const express  = require('express');
const router   = express.Router();
const UserData = require('../models/UserData');
const { auth } = require('./auth');

const GRADE_TABLE = [
  { min:90, gp:4.00, letter:'A'  },{ min:86, gp:3.67, letter:'A-' },
  { min:82, gp:3.33, letter:'B+' },{ min:78, gp:3.00, letter:'B'  },
  { min:74, gp:2.67, letter:'B-' },{ min:70, gp:2.33, letter:'C+' },
  { min:66, gp:2.00, letter:'C'  },{ min:62, gp:1.67, letter:'C-' },
  { min:58, gp:1.33, letter:'D+' },{ min:55, gp:1.00, letter:'D'  },
  { min:0,  gp:0.00, letter:'F'  }
];
function getGrade(pct) { return GRADE_TABLE.find(g => pct >= g.min) || GRADE_TABLE[GRADE_TABLE.length-1]; }
function cgpaFromCourses(courses) {
  let totalGP = 0, totalCr = 0;
  courses.forEach(c => {
    if (!c.assessments?.length) return;
    const avg = c.assessments.reduce((s,a) => s + parseFloat(a.percentage||0), 0) / c.assessments.length;
    const gp  = getGrade(avg).gp;
    totalGP += gp * (c.credits||3);
    totalCr += (c.credits||3);
  });
  return totalCr ? +(totalGP/totalCr).toFixed(2) : null;
}

router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const ud  = await UserData.findOne({ email: req.user.email });
    const msg = message.toLowerCase().trim();
    const academic  = ud?.academic  || { courses: [], calendar: [] };
    const todos     = ud?.todos     || [];
    const reminders = ud?.reminders || [];
    const today     = new Date().toISOString().split('T')[0];
    const todayTodos     = todos.filter(t => t.date === today);
    const pendingTodos   = todayTodos.filter(t => !t.completed);
    const upcomingRemind = reminders.filter(r => {
      if (r.dismissed) return false;
      const d = new Date(r.datetime), now = new Date();
      return d >= now && d <= new Date(now.getTime() + 7*24*60*60*1000);
    });

    const name   = req.user.name;
    const cgpa   = cgpaFromCourses(academic.courses);
    const courses = academic.courses;

    let reply = '';

    if (/hello|hi|hey/.test(msg)) {
      reply = 'Hello ' + name + '! I can help with grades, CGPA, tasks, and academic progress. What do you need?';
    } else if (/todo|task|pending/.test(msg)) {
      reply = pendingTodos.length
        ? 'You have ' + pendingTodos.length + ' pending task(s) for today: ' + pendingTodos.slice(0,3).map(t=>'<strong>'+t.text+'</strong>').join(', ') + (pendingTodos.length>3?' and more.':'.')
        : 'Great work ' + name + '! No pending tasks for today.';
    } else if (/reminder|upcoming|deadline|exam/.test(msg)) {
      reply = upcomingRemind.length
        ? 'You have ' + upcomingRemind.length + ' upcoming reminder(s): ' + upcomingRemind.slice(0,3).map(r=>'<strong>'+r.title+'</strong>').join(', ')
        : 'No reminders in the next 7 days.';
    } else if (/cgpa|gpa|grade point/.test(msg)) {
      reply = cgpa !== null
        ? 'Your current CGPA is <strong>' + cgpa + '</strong> based on ' + courses.length + ' course(s).'
        : 'No assessment data yet to calculate CGPA.';
    } else if (/course|subject|class/.test(msg)) {
      reply = courses.length
        ? 'You have <strong>' + courses.length + '</strong> course(s): ' + courses.map(c=>c.name).join(', ') + '.'
        : 'No courses added yet. Go to My Courses to add one.';
    } else if (/progress|performance|how am i/.test(msg)) {
      if (!courses.length) {
        reply = 'Add courses and scores to see your academic progress!';
      } else {
        const lines = courses.map(c => {
          if (!c.assessments?.length) return c.name + ': no scores yet';
          const avg = c.assessments.reduce((s,a) => s+parseFloat(a.percentage||0),0)/c.assessments.length;
          const g   = getGrade(avg);
          let line  = c.name + ': ' + avg.toFixed(1) + '% (' + g.letter + ', GP ' + g.gp + ')';
          if (c.targetCGPA) {
            const needed = c.targetCGPA * courses.reduce((s,x)=>s+(x.credits||3),0)
              - (cgpa||0) * courses.filter(x=>x.id!==c.id).reduce((s,x)=>s+(x.credits||3),0);
            line += ' | target: ' + c.targetCGPA;
          }
          return line;
        });
        reply = 'Academic summary:<br>' + lines.join('<br>') + '<br>CGPA: <strong>' + (cgpa ?? '—') + '</strong>';
      }
    } else if (/target|need|require|achieve/.test(msg)) {
      const courseMatch = courses.find(c => msg.includes(c.name.toLowerCase()) || msg.includes((c.code||'').toLowerCase()));
      if (courseMatch && courseMatch.targetCGPA) {
        const crAll   = courses.reduce((s,c)=>s+(c.credits||3),0);
        const crOther = courses.filter(c=>c.id!==courseMatch.id).reduce((s,c)=>s+(c.credits||3),0);
        const gpOther = courses.filter(c=>c.id!==courseMatch.id).reduce((s,c)=>{
          if (!c.assessments?.length) return s;
          const avg = c.assessments.reduce((x,a)=>x+parseFloat(a.percentage||0),0)/c.assessments.length;
          return s + getGrade(avg).gp*(c.credits||3);
        },0);
        const targetTotal = courseMatch.targetCGPA * crAll;
        const neededGP    = targetTotal - gpOther;
        const neededGrade = GRADE_TABLE.slice().reverse().find(g => g.gp >= neededGP / (courseMatch.credits||3));
        reply = 'For <strong>' + courseMatch.name + '</strong> to reach CGPA ' + courseMatch.targetCGPA + ', you need at least grade point <strong>' + neededGP.toFixed(2) + '</strong> (~' + (neededGrade?.letter||'A') + ').';
      } else {
        reply = 'Set a target CGPA on your course to get a precise calculation. Try: "What do I need in [course name]?"';
      }
    } else {
      reply = 'I can help with: grades, CGPA calculation, course progress, tasks, and reminders. Try asking "What is my CGPA?" or "Show my progress".';
    }

    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
