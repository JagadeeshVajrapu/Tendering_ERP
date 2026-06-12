import { Types } from 'mongoose';
import { CompanyTemplateData } from '../../models/CompanyTemplateData';
import { CompanyTemplateDataDto } from '../../types/documentPreparation';

function toDto(doc: {
  _id: Types.ObjectId;
  companyName: string;
  gst: string;
  pan: string;
  address: string;
  cin: string;
  msme: string;
  email?: string;
  phone?: string;
  updatedAt?: Date;
}): CompanyTemplateDataDto {
  return {
    id: String(doc._id),
    companyName: doc.companyName || '',
    gst: doc.gst || '',
    pan: doc.pan || '',
    address: doc.address || '',
    cin: doc.cin || '',
    msme: doc.msme || '',
    email: doc.email || '',
    phone: doc.phone || '',
    updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

const DEFAULT_TEMPLATE = {
  companyName: 'TenderNova Solutions Pvt. Ltd.',
  gst: '29AABCT1234A1Z5',
  pan: 'AABCT1234A',
  address: '42, MG Road, Bengaluru, Karnataka 560001',
  cin: 'U72900KA2018PTC112233',
  msme: 'UDYAM-KA-12-0012345',
  email: 'bids@tendernova.com',
  phone: '+91 80 1234 5678',
};

class CompanyTemplateService {
  async getTemplate(): Promise<CompanyTemplateDataDto> {
    let doc = await CompanyTemplateData.findOne().sort({ updatedAt: -1 });
    if (!doc) {
      doc = await CompanyTemplateData.create(DEFAULT_TEMPLATE);
    }
    return toDto(doc);
  }

  async updateTemplate(
    userId: Types.ObjectId,
    data: Partial<CompanyTemplateDataDto>
  ): Promise<CompanyTemplateDataDto> {
    const doc = await CompanyTemplateData.findOneAndUpdate(
      {},
      {
        $set: {
          companyName: data.companyName ?? '',
          gst: data.gst ?? '',
          pan: data.pan ?? '',
          address: data.address ?? '',
          cin: data.cin ?? '',
          msme: data.msme ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          updatedBy: userId,
        },
      },
      { upsert: true, new: true, sort: { updatedAt: -1 } }
    );
    return toDto(doc);
  }
}

export const companyTemplateService = new CompanyTemplateService();
