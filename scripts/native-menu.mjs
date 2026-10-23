export async function clickMenu(application, id, page) {
  if (page) await (await application.browserWindow(page)).evaluate((target) => target.focus());
  await application.evaluate(({ Menu, BrowserWindow }, id) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (!item) throw new Error(`Missing native menu item: ${id}`);
    item.click(item, BrowserWindow.getAllWindows()[0]);
  }, id);
}

export async function startProject(application, manager, button) {
  const opened = application.waitForEvent('window');
  await (button || manager.getByRole('button', { name: '启动项目', exact: true })).click();
  const page = await opened;
  page.setDefaultTimeout(15000);
  await page.locator('.project-workbench').waitFor();
  return page;
}

export async function closeProject(application, page) {
  const closed = page.waitForEvent('close');
  await (await application.browserWindow(page)).evaluate((target) => target.close());
  await closed;
}
