import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface DevVendor {
  _id: string;
  fullName: string;
  email: string;
  password?: string;
  googleId?: string;
  phone?: string;
  businessName?: string;
  vendorType?: string;
  vendorCode?: string;
  qrCodeUrl?: string;
  logo?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  description?: string;
  experience?: string;
  pricing?: Record<string, unknown>;
  services?: Record<string, unknown>;
  details?: Record<string, unknown>;
  createdAt: Date;
}

class DevStore {
  private byEmail = new Map<string, DevVendor>();
  private byId = new Map<string, DevVendor>();

  private codePrefix(vendorType?: string): string {
    switch ((vendorType || '').toLowerCase()) {
      case 'mandap': return 'gmmandap';
      case 'catering': return 'gmcatering';
      case 'decor': return 'gmdecor';
      case 'entertainment': return 'gment';
      case 'photography': return 'gmstudio';
      default: return 'gmvendor';
    }
  }

  private nextCodeForType(vendorType?: string): string {
    const prefix = this.codePrefix(vendorType);
    const count = this.list().filter(v => (v.vendorType || '').toLowerCase() === (vendorType || '').toLowerCase()).length;
    const num = 101 + count;
    return `${prefix}${num}`;
  }

  list(): DevVendor[] {
    return Array.from(this.byId.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findByEmail(email: string): DevVendor | undefined {
    return this.byEmail.get(email.toLowerCase());
  }

  async createVendor(data: {
    fullName: string;
    email: string;
    password?: string;
    phone?: string;
    businessName?: string;
    vendorType?: string;
    logo?: string;
    googleId?: string;
  }): Promise<DevVendor> {
    const id = randomUUID();
    const now = new Date();
    const hashed = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const vendor: DevVendor = {
      _id: id,
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      password: hashed,
      googleId: data.googleId,
      phone: data.phone,
      businessName: data.businessName,
      vendorType: data.vendorType,
      vendorCode: data.vendorType ? this.nextCodeForType(data.vendorType) : undefined,
      qrCodeUrl: data.vendorType ? `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${(data.vendorType || '').toLowerCase()}/${this.nextCodeForType(data.vendorType)}`)}` : undefined,
      logo: data.logo,
      onboardingStep: 1,
      onboardingCompleted: false,
      createdAt: now,
    };
    this.byEmail.set(vendor.email, vendor);
    this.byId.set(vendor._id, vendor);
    return vendor;
  }

  upsertByEmail(email: string, update: Partial<DevVendor>): DevVendor {
    const key = email.toLowerCase();
    const existing = this.byEmail.get(key);
    if (existing) {
      let merged = { ...existing, ...update };
      if ((update.vendorType || merged.vendorType) && !merged.vendorCode) {
        const type = (update.vendorType || merged.vendorType) as string;
        const code = this.nextCodeForType(type);
        merged = {
          ...merged,
          vendorCode: code,
          qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${type.toLowerCase()}/${code}`)}`
        };
      }
      this.byEmail.set(key, merged);
      this.byId.set(merged._id, merged);
      return merged;
    }
    const created: DevVendor = {
      _id: randomUUID(),
      fullName: update.fullName || "",
      email: key,
      createdAt: new Date(),
      onboardingStep: 1,
      onboardingCompleted: false,
      ...update,
    };
    if (created.vendorType && !created.vendorCode) {
      const code = this.nextCodeForType(created.vendorType);
      created.vendorCode = code;
      created.qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${(created.vendorType || '').toLowerCase()}/${code}`)}`;
    }
    this.byEmail.set(key, created);
    this.byId.set(created._id, created);
    return created;
  }
}

export const devStore = new DevStore();
export let isDbConnected = false;
export const setDbConnected = (v: boolean) => {
  isDbConnected = v;
};
