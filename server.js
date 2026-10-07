const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawhome')
  .then(() => console.log('MongoDB connected'))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });

const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['shelter', 'adopter'], required: true }
}));
const Pet = mongoose.model('Pet', new mongoose.Schema({
  shelter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  species: { type: String, enum: ['Dog', 'Cat', 'Rabbit', 'Other'], required: true },
  breed: { type: String, default: 'Mixed' },
  ageMonths: { type: Number, required: true, min: 0 },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['available', 'adopted'], default: 'available' }
}, { timestamps: true }));
const requestSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });
requestSchema.index({ pet: 1, user: 1 }, { unique: true });   // one request per person per pet
const Request = mongoose.model('Request', requestSchema);

const app = express();
app.use(express.json());
app.use(session({ secret: 'pawhome-secret-change-me', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

const need = role => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (role && req.session.user.role !== role) return res.status(403).json({ error: `Only a ${role} can do this.` });
  next();
};
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.code === 11000 ? 'You already sent a request for this pet.' : (e.message || 'Something went wrong.') }));
const validId = id => mongoose.isValidObjectId(id);

// ---------- Auth ----------
app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || !['shelter', 'adopter'].includes(role)) throw new Error('Fill in all fields.');
  if (password.length < 6) throw new Error('Password needs at least 6 characters.');
  if (await User.findOne({ email: email.toLowerCase().trim() })) throw new Error('This email is already registered.');
  const u = await User.create({ name, email, phone, password: bcrypt.hashSync(password, 10), role });
  req.session.user = { id: u._id, name: u.name, role: u.role };
  res.json(req.session.user);
}));
app.post('/api/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase().trim() });
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password)) return res.status(401).json({ error: 'Wrong email or password.' });
  req.session.user = { id: u._id, name: u.name, role: u.role };
  res.json(req.session.user);
}));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json(req.session.user || null));

// ---------- Pets ----------
app.get('/api/pets', wrap(async (req, res) => {
  const f = {};
  if (req.query.species) f.species = req.query.species;
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    f.$or = [{ name: rx }, { breed: rx }, { description: rx }];
  }
  res.json(await Pet.find(f).populate('shelter', 'name phone').sort({ status: 1, createdAt: -1 }));
}));

app.post('/api/pets', need('shelter'), wrap(async (req, res) => {
  const { name, species, breed, ageMonths, gender, description } = req.body;
  if (!name || !species || !gender || !description || !(ageMonths >= 0)) throw new Error('Fill in all fields.');
  res.json(await Pet.create({ shelter: req.session.user.id, name, species, breed: breed || 'Mixed', ageMonths, gender, description }));
}));

app.delete('/api/pets/:id', need('shelter'), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid pet.');
  const pet = await Pet.findOneAndDelete({ _id: req.params.id, shelter: req.session.user.id });
  if (!pet) return res.status(404).json({ error: 'Pet not found.' });
  await Request.deleteMany({ pet: pet._id });
  res.json({ ok: true });
}));

// ---------- Adoption requests ----------
app.post('/api/pets/:id/request', need('adopter'), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid pet.');
  const pet = await Pet.findOne({ _id: req.params.id, status: 'available' });
  if (!pet) throw new Error('This pet is no longer available.');
  if (!req.body.message) throw new Error('Tell the shelter a little about your home and why you want to adopt.');
  res.json(await Request.create({ pet: pet._id, user: req.session.user.id, message: req.body.message }));
}));

app.get('/api/pets/:id/requests', need('shelter'), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid pet.');
  const pet = await Pet.findOne({ _id: req.params.id, shelter: req.session.user.id });
  if (!pet) return res.status(404).json({ error: 'Pet not found.' });
  res.json(await Request.find({ pet: pet._id }).populate('user', 'name email phone').sort({ createdAt: -1 }));
}));

app.post('/api/requests/:id/:action', need('shelter'), wrap(async (req, res) => {
  const { id, action } = req.params;
  if (!validId(id) || !['approve', 'reject'].includes(action)) throw new Error('Invalid request.');
  const r = await Request.findById(id).populate('pet');
  if (!r || String(r.pet.shelter) !== String(req.session.user.id)) return res.status(404).json({ error: 'Request not found.' });
  if (r.status !== 'pending') throw new Error('This request is already decided.');
  if (action === 'reject') { r.status = 'rejected'; await r.save(); return res.json({ ok: true }); }
  if (r.pet.status !== 'available') throw new Error('This pet is already adopted.');
  r.status = 'approved'; await r.save();
  await Request.updateMany({ pet: r.pet._id, _id: { $ne: r._id }, status: 'pending' }, { status: 'rejected' });
  await Pet.updateOne({ _id: r.pet._id }, { status: 'adopted' });
  res.json({ ok: true });
}));

// ---------- Dashboard ----------
app.get('/api/dashboard', need(), wrap(async (req, res) => {
  const u = req.session.user;
  if (u.role === 'adopter') return res.json(await Request.find({ user: u.id }).populate({ path: 'pet', populate: { path: 'shelter', select: 'name phone' } }).sort({ createdAt: -1 }));
  const pets = await Pet.find({ shelter: u.id }).sort({ createdAt: -1 }).lean();
  for (const p of pets) p.pending = await Request.countDocuments({ pet: p._id, status: 'pending' });
  res.json(pets);
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PawHome running at http://localhost:${PORT}`));
