DROP TABLE IF EXISTS Admins;
DROP TABLE IF EXISTS Vendors;

CREATE TABLE Admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE Vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  businessName TEXT NOT NULL,
  vendorType TEXT NOT NULL,
  addressLine1 TEXT,
  addressLine2 TEXT,
  village TEXT,
  mandal TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  mapsLink TEXT,
  experience TEXT,
  description TEXT,
  logo TEXT,
  photos TEXT, -- JSON array
  pricing TEXT, -- JSON object
  services TEXT, -- JSON object
  details TEXT, -- JSON object
  businessType TEXT,
  registrationState TEXT,
  registrationNumber TEXT,
  registrationDoc TEXT,
  bankName TEXT,
  accountNumber TEXT,
  ifscCode TEXT,
  beneficiaryName TEXT,
  panNumber TEXT,
  gstNumber TEXT,
  upiId TEXT,
  isVerified BOOLEAN DEFAULT 0,
  onboardingStep INTEGER DEFAULT 1,
  onboardingCompleted BOOLEAN DEFAULT 0,
  feeAccepted BOOLEAN DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
);
