/* ================================================
   UserData — central document holding all per-user
   data: todos, academic, reminders, dayplans, sessions.
   Mirrors the previous individual JSON file approach
   but stored as a single MongoDB document per user.
   ================================================ */
const mongoose = require('mongoose');

// ── Assessment sub-schema ──────────────────────────────
const AssessmentSchema = new mongoose.Schema({
  id:          String,
  type:        { type: String, default: 'exam' },
  title:       String,
  score:       Number,
  totalScore:  { type: Number, default: 100 },
  date:        String,
  weight:      { type: Number, default: 100 },
  percentage:  String,
  addedAt:     String,
  componentName:   String,
  fullMark:        Number,
  obtainedMark:    Number,
  isDistribution:  { type: Boolean, default: false }
}, { _id: false });

// ── Marks-distribution component schema ───────────────
const MarkComponentSchema = new mongoose.Schema({
  name:      String,
  fullMark:  Number,
  obtain:    { type: Number, default: null }
}, { _id: false });

// ── Course sub-schema ──────────────────────────────────
const CourseSchema = new mongoose.Schema({
  id:           String,
  name:         String,
  code:         String,
  instructor:   { type: String, default: '' },
  credits:      { type: Number, default: 3 },
  targetCGPA:   { type: Number, default: null },
  totalMarks:   { type: Number, default: 100 },
  distribution: { type: [MarkComponentSchema], default: [] },
  assessments:  { type: [AssessmentSchema],    default: [] },
  createdAt:    String
}, { _id: false });

// ── Calendar event sub-schema ──────────────────────────
const CalEventSchema = new mongoose.Schema({
  id:          String,
  title:       String,
  date:        String,
  type:        { type: String, default: 'event' },
  courseId:    { type: String, default: null },
  description: { type: String, default: '' },
  createdAt:   String
}, { _id: false });

// ── Todo sub-schema ────────────────────────────────────
const TodoSchema = new mongoose.Schema({
  id:        String,
  text:      String,
  date:      String,
  priority:  { type: String, default: 'medium' },
  category:  { type: String, default: 'general' },
  completed: { type: Boolean, default: false },
  createdAt: String,
  updatedAt: String
}, { _id: false });

// ── Reminder sub-schema ────────────────────────────────
const ReminderSchema = new mongoose.Schema({
  id:        String,
  title:     String,
  datetime:  String,
  type:      { type: String, default: 'custom' },
  courseId:  { type: String, default: null },
  repeat:    { type: String, default: 'none' },
  note:      { type: String, default: '' },
  dismissed: { type: Boolean, default: false },
  createdAt: String
}, { _id: false });

// ── Session sub-schema ─────────────────────────────────
const SessionSchema = new mongoose.Schema({
  sessionId:   String,
  loginTime:   String,
  logoutTime:  { type: String, default: null },
  toolsUsed:   { type: Array, default: [] }
}, { _id: false });

// ── Main UserData schema ───────────────────────────────
const UserDataSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true },
  name:     String,
  phone:    String,
  todos:    { type: [TodoSchema],     default: [] },
  dayplans: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  academic: {
    courses:  { type: [CourseSchema],   default: [] },
    calendar: { type: [CalEventSchema], default: [] }
  },
  reminders: { type: [ReminderSchema], default: [] },
  sessions:  { type: [SessionSchema],  default: [] }
}, { timestamps: true });

module.exports = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);
