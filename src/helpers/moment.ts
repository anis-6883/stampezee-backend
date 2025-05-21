import moment from "moment-timezone";

export const convertToUTC = (localTime: string, timeZone: string) => {
  return moment.tz(localTime, "YYYY-MM-DD HH:mm", timeZone).utc().format();
};

export const getUTC = (
  localTime: Date | string,
  timeZone: string,
  startOfDay: boolean = false,
  endOfDay: boolean = false
): Date => {
  if (startOfDay && endOfDay) {
    throw new Error("startOfDay and endOfDay cannot both be true!");
  }

  let m = moment.tz(localTime, timeZone);

  if (startOfDay) {
    m = m.startOf("day");
  } else if (endOfDay) {
    m = m.endOf("day");
  }

  return new Date(m.utc().format()); // returns UTC Date object
};

export const countDaysLeft = (date: Date) => {
  var now = moment();
  var inputDate = moment(date);
  var difference = inputDate.diff(now, "days");
  return difference + 1;
};
