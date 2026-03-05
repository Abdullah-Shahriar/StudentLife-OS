const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const UserData = require('../models/UserData');
const { auth } = require('./auth');

// GET all academic data
router.get('/', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    res.json(ud?.academic || { courses: [], calendar: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD course
router.post('/course', auth, async (req, res) => {
  try {
    const { name, code, credits, instructor, targetCGPA, distribution } = req.body;
    const course = {
      id: uuidv4(), name, code, credits: credits || 3,
      instructor: instructor || '', targetCGPA: targetCGPA || null,
      distribution: distribution || [], assessments: [], createdAt: new Date().toISOString()
    };
    await UserData.findOneAndUpdate({ email: req.user.email }, { $push: { 'academic.courses': course } }, { upsert: true });
    res.json(course);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE course
router.put('/course/:id', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    const c  = ud?.academic?.courses?.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Course not found' });
    Object.assign(c, req.body);
    await ud.save();
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE course
router.delete('/course/:id', auth, async (req, res) => {
  try {
    await UserData.findOneAndUpdate({ email: req.user.email }, { $pull: { 'academic.courses': { id: req.params.id } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SET mark distribution for a course
router.put('/course/:id/distribution', auth, async (req, res) => {
  try {
    const { distribution } = req.body; // array of {name, fullMark, obtain}
    const ud = await UserData.findOne({ email: req.user.email });
    const c  = ud?.academic?.courses?.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Course not found' });
    c.distribution = distribution;
    await ud.save();
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD assessment
router.post('/course/:id/assessment', auth, async (req, res) => {
  try {
    const { type, title, score, totalScore, date, weight } = req.body;
    const ud = await UserData.findOne({ email: req.user.email });
    const c  = ud?.academic?.courses?.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Course not found' });
    const assessment = {
      id: uuidv4(), type: type || 'exam', title,
      score: parseFloat(score), totalScore: parseFloat(totalScore) || 100,
      date: date || new Date().toISOString().split('T')[0],
      weight: parseFloat(weight) || 100,
      percentage: ((parseFloat(score) / (parseFloat(totalScore) || 100)) * 100).toFixed(2),
      addedAt: new Date().toISOString()
    };
    c.assessments.push(assessment);
    await ud.save();
    res.json(assessment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE assessment
router.put('/course/:courseId/assessment/:assessId', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    const c  = ud?.academic?.courses?.find(c => c.id === req.params.courseId);
    if (!c) return res.status(404).json({ error: 'Course not found' });
    const a = c.assessments.find(a => a.id === req.params.assessId);
    if (!a) return res.status(404).json({ error: 'Assessment not found' });
    Object.assign(a, req.body);
    if (req.body.score != null || req.body.totalScore != null)
      a.percentage = ((a.score / a.totalScore) * 100).toFixed(2);
    await ud.save();
    res.json(a);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE assessment
router.delete('/course/:courseId/assessment/:assessId', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    const c  = ud?.academic?.courses?.find(c => c.id === req.params.courseId);
    if (c) { c.assessments = c.assessments.filter(a => a.id !== req.params.assessId); await ud.save(); }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD calendar event
router.post('/calendar', auth, async (req, res) => {
  try {
    const { title, date, type, courseId, description } = req.body;
    const event = { id: uuidv4(), title, date, type: type || 'event', courseId: courseId || null, description: description || '', createdAt: new Date().toISOString() };
    await UserData.findOneAndUpdate({ email: req.user.email }, { $push: { 'academic.calendar': event } }, { upsert: true });
    res.json(event);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE calendar event
router.delete('/calendar/:id', auth, async (req, res) => {
  try {
    await UserData.findOneAndUpdate({ email: req.user.email }, { $pull: { 'academic.calendar': { id: req.params.id } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CGPA calculator helper
router.get('/cgpa', auth, async (req, res) => {
  try {
    const ud       = await UserData.findOne({ email: req.user.email });
    const courses  = ud?.academic?.courses || [];
    const GRADE_TABLE = [
      { min:90, gp:4.00, letter:'A'  },
      { min:86, gp:3.67, letter:'A-' },
      { min:82, gp:3.33, letter:'B+' },
      { min:78, gp:3.00, letter:'B'  },
      { min:74, gp:2.67, letter:'B-' },
      { min:70, gp:2.33, letter:'C+' },
      { min:66, gp:2.00, letter:'C'  },
      { min:62, gp:1.67, letter:'C-' },
      { min:58, gp:1.33, letter:'D+' },
      { min:55, gp:1.00, letter:'D'  },
      { min:0,  gp:0.00, letter:'F'  },
    ];
    function getGrade(pct) { return GRADE_TABLE.find(g => pct >= g.min) || GRADE_TABLE[GRADE_TABLE.length-1]; }
    function courseAvgPct(c) {
      if (!c.assessments?.length) return null;
      const total = c.assessments.reduce((s,a) => s + parseFloat(a.percentage||0), 0);
      return total / c.assessments.length;
    }
    let totalCredits = 0, totalPoints = 0;
    const breakdown = courses.map(c => {
      const pct    = courseAvgPct(c);
      const grade  = pct != null ? getGrade(pct) : null;
      const cr     = c.credits || 3;
      if (grade) { totalCredits += cr; totalPoints += grade.gp * cr; }
      return { id: c.id, name: c.name, code: c.code, credits: cr, avgPct: pct ? +pct.toFixed(2) : null, grade: grade?.letter || '—', gp: grade?.gp ?? null, target: c.targetCGPA };
    });
    const cgpa = totalCredits ? +(totalPoints / totalCredits).toFixed(2) : null;
    res.json({ cgpa, totalCredits, breakdown });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
