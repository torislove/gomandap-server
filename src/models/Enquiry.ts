import mongoose from "mongoose";

const EnquirySchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" }, // Optional if guest
    name: { type: String, required: true }, // Captured from form or user profile
    phone: { type: String, required: true },
    email: { type: String },
    location: { type: String, required: true },
    eventType: { type: String, required: true },
    eventDate: { type: Date },
    guestCount: { type: Number },
    budget: { type: String }, // e.g. "50k-1L"
    services: [{ type: String }], // ["Venue", "Catering"]
    message: { type: String },

    // Vendor Specific Linkage
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    source: { type: String, default: 'website' }, // 'website', 'client_panel', 'manual'

    status: { type: String, default: "new", enum: ["new", "contacted", "qualified", "converted", "closed"] },
    createdAt: { type: Date, default: Date.now }
});

export const Enquiry = mongoose.model("Enquiry", EnquirySchema);
