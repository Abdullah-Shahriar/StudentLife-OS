const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auth, getUserDir } = require('./auth');

function getAcademic(email) {
  const f = path.join(getUserDir(email), 'academic.json');
  return fs.readJsonSync(f, { throws: false }) || { courses: [], calendar: [] };
}
function saveAcademic(email, data) {
  fs.writeJsonSync(path.join(getUserDir(email), 'academic.json'), data, { spaces: 2 });
}

// GET all academic data
router.get('/', auth, (req, res) => res.json(getAcademic(req.user.email)));

// ADD course
router.post('/course', auth, (req, res) => {
  const { name, code, credits, instructor, totalMarks } = req.body;
  const data = getAcademic(req.user.email);
  const course = {
    id: uuidv4(), name, code, credits: credits || 3,
    instructor: instructor || '', totalMarks: totalMarks || 100,
    assessments: [], createdAt: new Date().toISOString()
  };
  data.courses.push(course);
  saveAcademic(req.user.email, data);
  res.json(course);
});

// UPDATE course
router.put('/course/:id', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  const idx = data.courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Course not found' });
  data.courses[idx] = { ...data.courses[idx], ...req.body };
  saveAcademic(req.user.email, data);
  res.json(data.courses[idx]);
});

// DELETE course
router.delete('/course/:id', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  data.courses = data.courses.filter(c => c.id !== req.params.id);
  saveAcademic(req.user.email, data);
  res.json({ success: true });
});

// ADD assessment to course (exam/test/assignment/presentation)
router.post('/course/:id/assessment', auth, (req, res) => {
  const { type, title, score, totalScore, date, weight } = req.body;
  const data = getAcademic(req.user.email);
  const course = data.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const assessment = {
    id: uuidv4(), type: type || 'exam', title, score: parseFloat(score),
    totalScore: parseFloat(totalScore) || 100, date: date || new Date().toISOString().split('T')[0],
    weight: parseFloat(weight) || 100, percentage: ((parseFloat(score) / parseFloat(totalScore)) * 100).toFixed(2),
    addedAt: new Date().toISOString()
  };
  course.assessments.push(assessment);
  saveAcademic(req.user.email, data);
  res.json(assessment);
});

// UPDATE assessment
router.put('/course/:courseId/assessment/:assessId', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  const course = data.courses.find(c => c.id === req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const idx = course.assessments.findIndex(a => a.id === req.params.assessId);
  if (idx === -1) return res.status(404).json({ error: 'Assessment not found' });
  const updated = { ...course.assessments[idx], ...req.body };
  if (req.body.score || req.body.totalScore) {
    updated.percentage = ((updated.score / updated.totalScore) * 100).toFixed(2);
  }
  course.assessments[idx] = updated;
  saveAcademic(req.user.email, data);
  res.json(updated);
});

// DELETE assessment
router.delete('/course/:courseId/assessment/:assessId', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  const course = data.courses.find(c => c.id === req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  course.assessments = course.assessments.filter(a => a.id !== req.params.assessId);
  saveAcademic(req.user.email, data);
  res.json({ success: true });
});

// ADD calendar event
router.post('/calendar', auth, (req, res) => {
  const { title, date, type, courseId, description } = req.body;
  const data = getAcademic(req.user.email);
  const event = {
    id: uuidv4(), title, date, type: type || 'event',
    courseId: courseId || null, description: description || '',
    createdAt: new Date().toISOString()
  };
  data.calendar.push(event);
  saveAcademic(req.user.email, data);
  res.json(event);
});

// DELETE calendar event
router.delete('/calendar/:id', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  data.calendar = data.calendar.filter(e => e.id !== req.params.id);
  saveAcademic(req.user.email, data);
  res.json({ success: true });
});

// GET stats / progress data
router.get('/stats', auth, (req, res) => {
  const data = getAcademic(req.user.email);
  const stats = data.courses.map(course => {
    const sorted = [...course.assessments].sort((a, b) => new Date(a.date) - new Date(b.date));
    const avg = sorted.length ? (sorted.reduce((s, a) => s + parseFloat(a.percentage), 0) / sorted.length).toFixed(2) : 0;
    return { courseId: course.id, courseName: course.name, code: course.code, assessments: sorted, average: parseFloat(avg) };
  });
  res.json(stats);
});

module.exports = router;
