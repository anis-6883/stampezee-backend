import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import { apiResponse, asyncHandler } from "../../helpers";
import Branch from "../../models/branch";
import Retailer from "../../models/retailer";
import Stamp from "../../models/stamp";

/**
 * Create Retailers
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createRetailers = asyncHandler(async (req: Request, res: Response) => {
  const { retailerNumber = 10 } = req.query;
  const retailerPromises = [];

  for (let i = 0; i < Number(retailerNumber); i++) {
    const country = faker.location.country();
    const hashedPassword = await bcrypt.hash("12345678", 10);

    retailerPromises.push(
      Retailer.create({
        storeName: faker.company.name(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        fullName: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        isVerified: true,
        verifiedAt: Date.now(),
        password: hashedPassword,
        image: null,
        ref: "self",
        status: true,
        dialCode: "+880",
        phone: "1987518025",
        country,
        city: country,
        province: country,
        postalCode: faker.location.zipCode(),
        address: faker.location.streetAddress(),
      })
    );
  }

  // Wait for all the retailer creations to complete
  await Promise.all(retailerPromises);

  return apiResponse(res, 201, true, "Retailers created successfully!");
});

/**
 * Create Branches
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createBranches = asyncHandler(async (req: Request, res: Response) => {
  const retailerIds: any = (await Retailer.find({}, { _id: 1 }).limit(10)).map((retailer) => retailer._id);

  for (let id of retailerIds) {
    const [lat, long] = faker.location.nearbyGPSCoordinate({
      origin: [23.767533401104203, 90.35895030364509],
      radius: 3,
      isMetric: true,
    });

    await Branch.create({
      name: faker.company.name(),
      address: {
        loc: {
          type: "Point",
          coordinates: [long, lat],
        },
        name: faker.location.streetAddress(true),
      },
      retailerId: id,
      source: "subscription",
    });
  }

  return apiResponse(res, 201, true, "Branch created successfully!");
});

/**
 * Create Stamps
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export const createStamps = asyncHandler(async (req: Request, res: Response) => {
  // const retailerIds: any = (await Retailer.find({}, { _id: 1 })).map((retailer) => retailer._id);

  // for (let id of retailerIds) {
  //   const branches: any = await Branch.find({ retailerId: id });

  //   if (branches.length > 0) {
  //     for (let branch of branches) {
  //       const randInt = _.random(1, 10);

  //       await Stamp.create({
  //         retailerId: id,
  //         branchId: branch._id,
  //         stampImageId: "6677eef4dde9736b3636f851",
  //         categoryId: "666976e21765b4bdf352ca4e",
  //         title: `Buy ${randInt} Kacchi Get 1 Mojo Drink 500ml`,
  //         description: faker.lorem.sentences(2),
  //         rules: `You need to buy ${randInt} Kacchi Get 1 Mojo Drink 500ml`,
  //         noOfStampsToCollect: randInt,
  //         minPurchaseAmount: 0,
  //         rewardType: randInt > 5 ? "promotion" : "discount",
  //         promotionReward: randInt > 5 ? "1 Mojo Drink 500ml Free" : "",
  //         discountReward: randInt > 5 ? 0 : randInt,
  //         startedAt: moment(),
  //         expiredAt: moment().add(30, "days"),
  //         isPublished: true,
  //         hasValidity: false,
  //       });
  //     }
  //   }
  // }

  for (let index = 0; index < 10; index++) {
    const randInt = _.random(1, 10);
    await Stamp.create({
      retailerId: "668a8a9bf5c91dc6f712288f", // anisuzzaman6883@gmail.com
      branchId: "6697a382abced2d0aa2d4d20", // Asad Gate Branch
      stampImageId: "66a3342b67784d383d46d51a",
      categoryId: "666977021765b4bdf352ca57", // coffee
      title: `Buy ${randInt} Kacchi Get 1 Mojo Drink 500ml`,
      description: faker.lorem.sentences(2),
      rules: `You need to buy ${randInt} Kacchi Get 1 Mojo Drink 500ml`,
      noOfStampsToCollect: randInt,
      minPurchaseAmount: 0,
      rewardType: randInt > 5 ? "promotion" : "discount",
      promotionReward: randInt > 5 ? "1 Mojo Drink 500ml Free" : "",
      discountReward: randInt > 5 ? 0 : randInt,
      startedAt: moment(),
      expiredAt: moment().add(30, "days"),
      isPublished: true,
      hasValidity: false,
    });
  }

  return apiResponse(res, 201, true, "Stamp created successfully!");
});
