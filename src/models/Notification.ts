import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipientType: 'all' | 'vendorType' | 'specific';
  recipientId?: string; // For 'specific'
  recipientVendorType?: string; // For 'vendorType'
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  readBy: string[]; // Array of Vendor IDs who have read this notification
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipientType: { 
    type: String, 
    enum: ['all', 'vendorType', 'specific'], 
    required: true 
  },
  recipientId: { type: String },
  recipientVendorType: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['info', 'warning', 'success', 'alert'], 
    default: 'info' 
  },
  readBy: [{ type: String }], // Store vendor IDs
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
