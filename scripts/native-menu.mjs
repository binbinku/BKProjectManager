export async function clickMenu(application, id) {
  await application.evaluate(({ Menu, BrowserWindow }, id) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (!item) throw new Error(`Missing native menu item: ${id}`);
    item.click(item, BrowserWindow.getAllWindows()[0]);
  }, id);
}
