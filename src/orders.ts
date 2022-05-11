/**
 * Класс работы с заявками.
 */
import { randomUUID } from 'crypto';
import {
  OrderDirection,
  OrderExecutionReportStatus,
  OrderState,
  OrderType,
  PostOrderRequest
} from 'tinkoff-invest-api/dist/generated/orders.js';
import { RobotModule } from './base.js';

export class Orders extends RobotModule {
  items: OrderState[] = [];

  /**
   * Загружаем существующие заявки
   */
  async load() {
    const { orders } = await this.account.getOrders();
    this.items = orders;
    this.logItems();
  }

  /**
   * Создаем новую лимит-заявку
   */
  async postOrder({ direction, quantity, price }: Pick<PostOrderRequest, 'direction' | 'quantity' | 'price'>) {
    const order = await this.account.postOrder({
      figi: this.config.figi,
      quantity,
      direction,
      price,
      orderType: OrderType.ORDER_TYPE_LIMIT,
      orderId: randomUUID(),
    });
    const action = direction === OrderDirection.ORDER_DIRECTION_BUY ? 'покупку' : 'продажу';
    this.logger.warn(`Создана заявка на ${action}: лотов ${quantity}, цена ${this.api.helpers.toNumber(price)}`);
    return order;
    // console.log(order); // check initial comission
  }

  /**
   * Отменяем все существующие заявки для данного figi.
   */
  async cancelExistingOrders() {
    const existingOrders = this.items.filter(order => order.figi === this.config.figi);
    const tasks = existingOrders.map(async order => {
      const prevPrice = this.api.helpers.toNumber(order.initialSecurityPrice);
      this.logger.log(`Отмена предыдущей заявки ${order.orderId}, цена ${prevPrice}`);
      await this.account.cancelOrder(order.orderId);
    });
    await Promise.all(tasks);
  }

  private logItems() {
    this.logger.log(`Заявки загружены: ${this.items.length}`);
    this.items.forEach(item => {
      const s = [
        ' '.repeat(4),
        formatOrderStatus(item.executionReportStatus),
        item.direction === OrderDirection.ORDER_DIRECTION_BUY ? 'покупка' : 'продажа',
        item.lotsRequested,
        this.api.helpers.toMoneyString(item.initialOrderPrice),
        item.figi,
      ].join(' ');
      this.logger.log(s);
    });
  }
}

function formatOrderStatus(status: OrderExecutionReportStatus) {
  switch (status) {
    case OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_NEW: return 'Новая';
    case OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_FILL: return 'Исполнена';
    case OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_PARTIALLYFILL: return 'Частично исполнена';
    case OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_REJECTED: return 'Отклонена';
    case OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_CANCELLED: return 'Отменена пользователем';
    default: return `Неизвестный статус ${status}`;
  }
}
