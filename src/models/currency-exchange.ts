import { Document, Schema, model } from "mongoose";

export interface ICurrencyExchange extends Document {
  name: string;
  exchangeRate: number;
  status: boolean;
}

const currencyExchangeSchema = new Schema<ICurrencyExchange>(
  {
    name: { type: String, required: true, trim: true, unique: true },
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
