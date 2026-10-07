# PawHome - Pet Adoption Portal
**Stack:** HTML, CSS, JavaScript, Bootstrap 5, Node.js (Express), MongoDB (Mongoose)

## Run
1. Install Node.js and MongoDB Community Server (start MongoDB). Or use MongoDB Atlas and set `MONGO_URI`.
2. In this folder: `npm install` then `npm start`
3. Open http://localhost:3000

## Features
- Shelter: list pets (species, breed, age, gender, nature), see adoption requests with contact details, approve or reject, delete pets
- Adopter: search and filter pets, send one adoption request per pet with a short message, track request status
- Approving a request marks the pet as adopted and automatically rejects the other pending requests

## Collections
- users: name, email (unique), phone, password (hash), role (shelter / adopter)
- pets: shelter (ref), name, species, breed, ageMonths, gender, description, status (available / adopted)
- requests: pet (ref), user (ref), message, status (pending / approved / rejected); unique index on (pet, user)

## Viva points
- A unique compound index on (pet, user) stops duplicate requests at the database level.
- `populate()` is the MongoDB-with-Mongoose way of doing a JOIN.
- Passwords are hashed with bcrypt; every protected route checks login and role.
- Demo note: registration lets you pick the shelter role for easy demonstration.
- Future scope: pet photos, vaccination records, adoption agreement PDF, shelter verification.
