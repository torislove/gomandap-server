import { BotKnowledge } from '../models/BotKnowledge.js';
import { Vendor } from '../models/Vendor.js';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
// import OpenAI from 'openai'; // REMOVED
import dotenv from 'dotenv';

dotenv.config();

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // REMOVED

export class AIService {

  // --- Ingestion Methods ---

  async ingestPDF(buffer: Buffer, filename: string): Promise<any> {
    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      const text = data.text;

      // Store in Knowledge Base
      const kb = await BotKnowledge.create({
        sourceType: 'pdf',
        sourceUrl: filename,
        title: `PDF: ${filename}`,
        content: text,
        tags: ['document', 'pdf']
      });

      return kb;
    } catch (error) {
      console.error('PDF Ingest Error:', error);
      throw new Error('Failed to parse PDF');
    }
  }

  async ingestWeb(url: string): Promise<any> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      // Remove scripts, styles
      $('script').remove();
      $('style').remove();

      const title = $('title').text();
      const content = $('body').text().replace(/\s+/g, ' ').trim();

      const kb = await BotKnowledge.create({
        sourceType: 'web',
        sourceUrl: url,
        title: title || url,
        content: content.substring(0, 10000), // Limit size
        tags: ['web', 'scrape']
      });

      return kb;
    } catch (error) {
      console.error('Web Ingest Error:', error);
      throw new Error('Failed to scrape URL');
    }
  }

  async ingestImage(buffer: Buffer, filename: string): Promise<any> {
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      const text = ret.data.text;
      await worker.terminate();

      const kb = await BotKnowledge.create({
        sourceType: 'image',
        sourceUrl: filename,
        title: `Image: ${filename}`,
        content: text,
        tags: ['image', 'ocr']
      });

      return kb;
    } catch (error) {
      console.error('Image Ingest Error:', error);
      throw new Error('Failed to process image');
    }
  }

  // --- Analysis Methods ---

  async analyzeMarket(): Promise<string> {
    try {
      const vendors = await Vendor.find();
      const count = vendors.length;
      const byType: Record<string, number> = {};

      vendors.forEach(v => {
        const type = v.vendorType || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      });

      let report = `Market Analysis Report:\nTotal Vendors: ${count}\n\nDistribution:\n`;
      for (const [t, c] of Object.entries(byType)) {
        report += `- ${t}: ${c} vendors\n`;
      }

      return report;
    } catch (error) {
      return "Failed to analyze market.";
    }
  }

  async calculateBudget(guestCount: number, city?: string, quality: 'budget' | 'standard' | 'luxury' = 'standard'): Promise<string> {
    const basePerGuest = {
      'budget': 800,
      'standard': 1500,
      'luxury': 3500
    }[quality];

    const multiplier = city?.toLowerCase() === 'mumbai' || city?.toLowerCase() === 'delhi' ? 1.3 : 1.0;
    const total = guestCount * basePerGuest * multiplier;

    return `For a ${quality} wedding with ${guestCount} guests in ${city || 'your city'}, the estimated budget would be around ₹${(total / 100000).toFixed(2)} Lakhs. This includes venue, catering, and basic decor. Would you like a detailed breakdown?`;
  }

  async searchInternal(query: string): Promise<string[]> {
    try {
      // Use text search for better relevance if available, fallback to regex
      const results = await BotKnowledge.find({
        $text: { $search: query }
      }, {
        score: { $meta: "textScore" }
      }).sort({
        score: { $meta: "textScore" }
      }).limit(5);

      if (results.length === 0) {
        // Fallback to regex for partial matches
        const regex = new RegExp(query.split(' ').join('|'), 'i');
        const fallbackResults = await BotKnowledge.find({
          $or: [{ content: regex }, { title: regex }]
        }).limit(3);
        return fallbackResults.map(r => `SOURCE [${r.title}]: ${r.content.substring(0, 1000)}`);
      }

      return results.map(r => `SOURCE [${r.title}]: ${r.content.substring(0, 1000)}`);
    } catch (err) {
      console.error('Search Internal Error:', err);
      return [];
    }
  }

  async findVendors(query: string, city?: string, maxPrice?: number): Promise<any[]> {
    try {
      const dbQuery: any = { onboardingCompleted: true };
      if (city) dbQuery.city = new RegExp(city, 'i');

      const keywords = query.toLowerCase().split(' ');
      const typeMatches = ['mandap', 'venue', 'catering', 'decor', 'photography', 'entertainment', 'makeup'];
      const matchedType = typeMatches.find(t => keywords.includes(t));
      if (matchedType) dbQuery.vendorType = matchedType;

      // Price filtering logic if available in schema
      if (maxPrice) {
        dbQuery.$or = [
          { 'details.minPrice': { $lte: maxPrice } },
          { 'details.startingPrice': { $lte: maxPrice } }
        ];
      }

      const vendors = await Vendor.find(dbQuery)
        .select('businessName vendorType city state logo rating stats reviews isSponsored')
        .sort({ isSponsored: -1, 'stats.views': -1 })
        .limit(3);

      return vendors;
    } catch (error) {
      console.error('Find Vendors Error:', error);
      return [];
    }
  }

  // --- Chat Method (Lali Intelligence) ---

  async chat(query: string, context: any = {}): Promise<string> {
    try {
      const lowerQuery = query.toLowerCase();

      // 1. Intent Detection: Vendor Search
      const searchKeywords = ['find', 'search', 'show', 'recommend', 'look for', 'looking for'];
      const vendorKeywords = ['vendor', 'mandap', 'venue', 'catering', 'decor', 'photography', 'entertainment', 'makeup', 'studio'];

      const isSearchIntent = searchKeywords.some(k => lowerQuery.includes(k)) ||
        vendorKeywords.some(k => lowerQuery.includes(k));

      let additionalContext = "";
      let foundVendors: any[] = [];

      if (isSearchIntent) {
        // Extract city (naive extraction for now)
        const cities = ['hyderabad', 'pune', 'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata'];
        const city = cities.find(c => lowerQuery.includes(c));

        // Extract budget
        const budgetMatch = lowerQuery.match(/(?:under|below|around)\s*(?:rs|inr|₹)?\s*(\d+(?:k|l|m)?)/i);
        let budget: number | undefined;
        if (budgetMatch) {
          const val = budgetMatch[1].toLowerCase();
          if (val.endsWith('k')) budget = parseInt(val) * 1000;
          else if (val.endsWith('l')) budget = parseInt(val) * 100000;
          else budget = parseInt(val);
        }

        foundVendors = await this.findVendors(query, city, budget);
        if (foundVendors.length > 0) {
          return `I found some great vendors for you:\n${foundVendors.map(v => `- ${v.businessName} (${v.city})`).join('\n')}`;
        } else {
          return "I couldn't find any vendors matching your criteria right now. Please try different keywords or location.";
        }
      }

      // 2. Intent Detection: Market Analysis
      const analysisKeywords = ['analyze', 'analysis', 'trend', 'stats', 'number', 'count', 'report'];
      if (analysisKeywords.some((k: string) => lowerQuery.includes(k)) && lowerQuery.includes('vendor')) {
        return await this.analyzeMarket();
      }

      // 3. Intent Detection: Budget Estimation
      const budgetKeywords = ['budget', 'cost', 'price', 'estimate', 'how much'];
      if (budgetKeywords.some(k => lowerQuery.includes(k)) && lowerQuery.includes('guest')) {
        const guestMatch = lowerQuery.match(/(\d+)\s*guests?/);
        if (guestMatch) {
          const guests = parseInt(guestMatch[1]);
          const cities = ['mumbai', 'delhi', 'hyderabad', 'pune', 'bangalore'];
          const city = cities.find(c => lowerQuery.includes(c));
          const quality = lowerQuery.includes('luxury') ? 'luxury' : lowerQuery.includes('budget') ? 'budget' : 'standard';
          return await this.calculateBudget(guests, city, quality);
        }
      }

      // Fallback Response (since AI is removed)
      return "Namaste! I am here to help you find the best wedding vendors. Please ask me to 'find vendors in Pune' or 'estimate budget for 500 guests'.";

    } catch (error) {
      console.error("Lali Chat Error:", error);
      return "Namaste! I seem to have lost my connection to the palace. Please try again in a moment.";
    }
  }
}

export const aiService = new AIService();
