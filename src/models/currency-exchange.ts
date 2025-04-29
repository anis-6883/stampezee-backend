import { Document, Schema, model } from "mongoose";

export interface ICurrencyExchange extends Document {
  name: string;
  currency: string;
  currencyIcon: string;
  exchangeRate: number;
  status: boolean;
}

const currencyExchangeSchema = new Schema<ICurrencyExchange>(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, trim: true, unique: true },
    currencyIcon: { type: String, required: true, trim: true },
    exchangeRate: { type: Number, required: true },
    status: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const CurrencyExchange = model<ICurrencyExchange>("currency_exchanges", currencyExchangeSchema);

export default CurrencyExchange;
